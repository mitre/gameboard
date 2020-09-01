from aiohttp import web
from aiohttp_jinja2 import template

from app.utility.base_service import BaseService
from app.service.auth_svc import for_all_public_methods, check_authorization


@for_all_public_methods(check_authorization)
class GameboardApi(BaseService):
    RED_TEAM = 'red'
    BLUE_TEAM = 'blue'
    PID_FACT = 'host.process.id'
    AUTOCOLLECT_NAME = 'Auto-Collect'
    RED_POINT_MAPPING = {'collection': 2,
                         'credential-access': 3,
                         'defense-evasion': 4,
                         'exfiltration': 3,
                         'impact': 3,
                         'lateral-movement': 5,
                         'persistence': 6,
                         'privilege-escalation': 3}
    BLUE_POINT_MAPPING = {'detection': 2,
                          'hunt': 3,
                          'response': 3}

    def __init__(self, services):
        self.auth_svc = services.get('auth_svc')
        self.data_svc = services.get('data_svc')
        self.app_svc = services.get('app_svc')
        self.gameboard_svc = services.get('gameboard_svc')

    @template('gameboard.html')
    async def splash(self, request):
        red_ops = [red.display for red in await self.data_svc.locate('operations', dict(access=self.Access.RED))]
        blue_ops = [blue.display for blue in await self.data_svc.locate('operations', dict(access=self.Access.BLUE))]
        agents = await self.data_svc.locate('agents', match=dict(access=BaseService.Access.RED))
        hosts = set(agt.host for agt in agents)
        abilities = await self.data_svc.locate('abilities', match=dict(access=BaseService.Access.RED))
        tactics = await self._construct_splash_tactics(abilities)
        hidden_red_operations = await self._construct_hidden_red_operations()
        groups = await self._construct_groups()
        adversaries = sorted([a.display for a in await self.data_svc.locate('adversaries',
                                                                            match=dict(access=BaseService.Access.RED))],
                             key=lambda a: a['name'])
        return dict(red_ops=red_ops, blue_ops=blue_ops, hosts=hosts, tactics=tactics,
                    hidden_red_operations=hidden_red_operations, groups=groups, adversaries=adversaries)

    async def get_pieces(self, request):
        data = dict(await request.json())
        red_op = await self.data_svc.locate('operations', dict(id=data.get(self.RED_TEAM)))
        if red_op[0].access == self.Access.HIDDEN:
            blue_op = await self.data_svc.locate('operations',
                                                 dict(name=red_op[0].name+'_'+str(red_op[0].id) +
                                                      self.gameboard_svc.blue_op_name_modifier))
        else:
            blue_op = await self.data_svc.locate('operations', dict(id=data.get(self.BLUE_TEAM)))
        hidden = True if red_op[0].access == self.Access.HIDDEN else False
        access = await self.auth_svc.get_permissions(request)
        exchanges = self._get_exchanges(red_op, blue_op, hidden)
        self._add_points_to_exchanges(red_op, blue_op, exchanges)
        response = dict(access=self.BLUE_TEAM if self.Access.BLUE in access else self.RED_TEAM,
                        red_op_state=red_op[0].state if red_op else None,
                        blue_op_state=blue_op[0].state if blue_op else None,
                        exchanges=list(exchanges.items()),
                        points=self._total_points(exchanges),
                        hidden=hidden)
        return web.json_response(response)

    async def update_pin(self, request):
        data = dict(await request.json())
        link = await self.app_svc.find_link(data['link_id'])
        link.pin = int(data['updated_pin'])
        return web.json_response('completed')

    async def verify_detection(self, request):
        data = dict(await request.json())
        host = data.get('host')
        technique_id = data.get('technique')
        verify_type = data.get('verify')
        verify_info = data.get('info')
        op = None
        message = None
        verified = await self.gameboard_svc.does_verify_info_match_any_run_link(host, technique_id, verify_type,
                                                                                verify_info)
        if verified:
            op, message = await self.gameboard_svc.add_detection(verify_type, verified)
        return web.json_response(dict(verified=verified, red_operation=op, message=message))

    async def create_hidden_red_operation(self, request):
        data = dict(await request.json())
        group = data.get('group')
        op_name = data.get('op_name')
        adv_id = data.get('profile')
        new_op = None
        if group and op_name and adv_id:
            access = dict(access=[self.Access.HIDDEN])
            data = dict(name=op_name, group=group, adversary_id=adv_id,
                        planner='batch', auto_close=True)
            new_op = await self.get_service('rest_svc').create_operation(access=access, data=data)
        return web.json_response(dict(hidden_red_operation=new_op))

    def _get_exchanges(self, red_ops, blue_ops, hidden):
        exchanges = dict()
        self._set_pins(blue_ops)
        exchanges = self._add_links_to_exchanges(exchanges, self._get_sorted_links(blue_ops), team=self.BLUE_TEAM,
                                                 hidden=hidden)
        exchanges = self._add_links_to_exchanges(exchanges, self._get_sorted_links(red_ops), team=self.RED_TEAM,
                                                 hidden=hidden)
        return exchanges

    def _set_pins(self, blue_ops):
        if blue_ops and self.AUTOCOLLECT_NAME not in blue_ops[0].name:
            for lnk in blue_ops[0].chain:
                fact = next((f for f in lnk.used), None)
                if fact:
                    if fact.trait == self.PID_FACT:
                        lnk.pin = int(fact.value)
                    else:
                        lnk.pin = self._find_original_pid(blue_ops[0].all_relationships(), fact.trait, fact.value)

    def _add_links_to_exchanges(self, exchanges, links, team, hidden):
        for link in links:
            key = link.pid if team == self.RED_TEAM else link.pin
            if key in exchanges.keys():
                exchanges[key][team].append(link.display)
            else:
                if team == self.RED_TEAM:
                    if hidden:
                        self._add_hidden_link_to_exchanges(exchanges)
                    else:
                        exchanges[key] = dict(red=[link.display], blue=[])
                else:
                    exchanges[key] = dict(red=[], blue=[link.display])
        return exchanges

    @staticmethod
    def _add_hidden_link_to_exchanges(exchanges):
        hidden_link = dict(points=dict(value=1, reason='?'),
                           ability=dict(name='undetected', tactic='?', technique_id='?'),
                           finish='', paw='', facts=[], host='', status=0, hidden=True,
                           visibility=dict(adjustments=[], score=50))
        if 'undetected' in exchanges:
            exchanges['undetected']['red'].append(hidden_link)
        else:
            exchanges['undetected'] = dict(red=[hidden_link], blue=[])

    def _find_original_pid(self, relationships, trait, value):
        r_source = next((r.source for r in relationships if (r.target.trait == trait and r.target.value == value)), None)
        if r_source:
            if r_source.trait == self.PID_FACT:
                return int(r_source.value)
            return self._find_original_pid(relationships, r_source.trait, r_source.value)
        return 0

    @staticmethod
    def _get_sorted_links(ops):
        return sorted([lnk for op in ops for lnk in op.chain if lnk.finish and lnk.cleanup == 0], key=lambda i: i.finish)

    def _add_points_to_exchanges(self, red_op, blue_op, exchanges):
        for exchange in exchanges.values():
            if red_op:
                self._calc_red_points(blue_op, exchange)
            if blue_op:
                self._calc_blue_points(red_op, exchange)

    def _calc_red_points(self, blue_op, exchange):
        blue_detected = blue_op and len(exchange[self.BLUE_TEAM]) != 0

        for red_link in exchange[self.RED_TEAM]:
            if blue_detected:
                red_link['points'] = dict(value=0, reason='{} team detected this activity'.format(self.BLUE_TEAM))
            else:
                red_link['points'] = self._add_points(red_link, self.RED_POINT_MAPPING)

    def _calc_blue_points(self, red_op, exchange):
        for blue_link in exchange[self.BLUE_TEAM]:
            if red_op and len(exchange[self.RED_TEAM]) == 0:
                blue_link['points'] = dict(value=-1, reason='activity not performed by {} team'.format(self.RED_TEAM))
            else:
                blue_link['points'] = self._add_points(blue_link, self.BLUE_POINT_MAPPING)

        if len(exchange[self.BLUE_TEAM]) == 0 and len(exchange[self.RED_TEAM]) > 0:
            for red_link in exchange[self.RED_TEAM]:
                points_link = dict(points=self._adjust_blue_points(red_link))
                exchange[self.BLUE_TEAM].append(points_link)

    def _total_points(self, exchanges):
        red_points = 0
        blue_points = 0
        for exchange in exchanges.values():
            for link in exchange.get(self.RED_TEAM, []):
                red_points += link.get('points', {}).get('value', 0)
            for link in exchange.get(self.BLUE_TEAM, []):
                blue_points += link.get('points', {}).get('value', 0)
        return [red_points, blue_points]

    @staticmethod
    def _add_points(link, mapping):
        if link['status'] != 0:
            return dict(value=0, reason='link not in an okay state')
        tactic = link['ability']['tactic']
        return dict(value=mapping.get(tactic, 1), reason='performed {}'.format(tactic))

    def _adjust_blue_points(self, red_link):
        if red_link['visibility']['score'] >= 50:
            return dict(value=-2, reason='high visibility {} team activity not detected'.format(self.RED_TEAM))
        return dict(value=-1, reason='low visibility {} team activity not detected'.format(self.RED_TEAM))

    @staticmethod
    async def _construct_splash_tactics(abilities):
        tactics = dict()
        for ab in abilities:
            technique = (ab.technique_id, ab.technique_name)
            if ab.tactic in tactics:
                tactics[ab.tactic.lower()].add(technique)
            else:
                tactics[ab.tactic] = set([technique])
        for tactic in tactics:
            tactics[tactic] = list(tactics[tactic])
        return tactics

    async def _construct_hidden_red_operations(self):
        hidden_ops = await self.data_svc.locate('operations', match=dict(access=self.Access.HIDDEN))
        hidden_red_ops = []
        for op in hidden_ops:
            if op.group != 'blue':
                hidden_red_ops.append(op.display)
        return hidden_red_ops

    async def _construct_groups(self):
        hosts = [h.display for h in await self.data_svc.locate('agents') if h.group != 'blue']
        return sorted(list(set(([h['group'] for h in hosts]))))
