import uuid
from base64 import b64encode
from copy import deepcopy

from aiohttp import web
from aiohttp_jinja2 import template

from app.objects.c_ability import Ability
from app.objects.c_source import Source
from app.objects.secondclass.c_fact import Fact
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
        self.rest_svc = services.get('rest_svc')

    @template('gameboard.html')
    async def splash(self, request):
        red_ops = [red.display for red in await self.data_svc.locate('operations', dict(access=self.Access.RED))]
        blue_ops = [blue.display for blue in await self.data_svc.locate('operations', dict(access=self.Access.BLUE))]
        return dict(red_ops=red_ops, blue_ops=blue_ops)

    async def get_pieces(self, request):
        data = dict(await request.json())
        red_op = await self.data_svc.locate('operations', dict(id=data.get(self.RED_TEAM)))
        blue_op = await self.data_svc.locate('operations', dict(id=data.get(self.BLUE_TEAM)))
        access = await self.auth_svc.get_permissions(request)
        exchanges = self._get_exchanges(red_op, blue_op)
        self._add_points_to_exchanges(red_op, blue_op, exchanges)
        response = dict(access=self.BLUE_TEAM if self.Access.BLUE in access else self.RED_TEAM,
                        red_op_state=red_op[0].state if red_op else None,
                        blue_op_state=blue_op[0].state if blue_op else None,
                        exchanges=list(exchanges.items()),
                        points=self._total_points(exchanges))
        return web.json_response(response)

    async def update_pin(self, request):
        data = dict(await request.json())
        link = await self.app_svc.find_link(str(data['link_id']))
        if data['is_child_pid']:
            result = await self._match_child_process(data['updated_pin'], link)
            if result:
                return web.json_response('Pinned to parent PID: ' + result)
            else:
                return web.json_response('Child PID not matched to any parent PIDs')
        else:
            link.pin = int(data['updated_pin'])
            return web.json_response('Pinned to PID: ' + str(data['updated_pin']))

    async def analytic(self, request):
        data = dict(await request.json())
        try:
            await self._start_custom_analytic_operation(data.get('name'), data.get('query'))
        except Exception as e:
            print(e)
            import traceback
            traceback.print_exc()
        return web.json_response('success')

    def _get_exchanges(self, red_ops, blue_ops):
        exchanges = dict()
        self._set_pins(blue_ops)
        exchanges = self._add_links_to_exchanges(exchanges, self._get_sorted_links(red_ops), team=self.RED_TEAM)
        exchanges = self._add_links_to_exchanges(exchanges, self._get_sorted_links(blue_ops), team=self.BLUE_TEAM)
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

    def _add_links_to_exchanges(self, exchanges, links, team):
        for link in links:
            key = link.pid if team == self.RED_TEAM else link.pin
            if key in exchanges.keys():
                exchanges[key][team].append(link.display)
            else:
                if team == self.RED_TEAM:
                    exchanges[key] = dict(red=[link.display], blue=[])
                else:
                    exchanges[key] = dict(red=[], blue=[link.display])
        return exchanges

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

    async def _start_custom_analytic_operation(self, name, query):
        adversary = await self._create_analytic_adversary(name, query)
        operation = await self._create_analytic_operation(operation_name=name, adversary=adversary)
        return operation

    @staticmethod
    async def _create_analytic_source():
        source_id = str(uuid.uuid4())
        source_name = 'analytic-{}'.format(source_id)
        facts = [Fact(trait='test', value='test')]
        return Source(id=source_id, name=source_name, facts=facts)

    async def _create_analytic_adversary(self, name, query):
        adversary_id = str(uuid.uuid4())
        adversary_data = dict(id=adversary_id,
                              name=name + ' adversary',
                              description='custom analytic profile',
                              objective=[])
        abilities = await self._create_analytic_ability(name, query)
        adversary_data['atomic_ordering'] = abilities
        await self.rest_svc.persist_adversary(dict(access=[self.rest_svc.Access.BLUE]), adversary_data)
        return adversary_id

    async def _create_analytic_ability(self, name, query):
        encoded_test = b64encode(query.strip().encode('utf-8')).decode()
        reference_ability = (await self.data_svc.locate('abilities', match=dict(ability_id='bf565e6a-0037-4aa4-852f-1afa222c76db')))[0]  #TODO: replace
        parsers = deepcopy(reference_ability.parsers)
        ability_id = str(uuid.uuid4())
        for pl in ['windows', 'darwin', 'linux']:
            ability = Ability(ability_id=ability_id,
                              tactic='analytic',
                              technique='analytic',
                              technique_name='analytic',
                              technique_id='x',
                              test=encoded_test,
                              description='custom analytic',
                              executor='elasticsearch',
                              name=name, platform=pl,
                              parsers=parsers,
                              timeout=60,
                              buckets=['analytic'],
                              access=self.Access.BLUE)
            await self.data_svc.store(ability)
        return [dict(ability_id=ability.ability_id)]

    async def _create_analytic_operation(self, operation_name, adversary):
        access = dict(access=[self.Access.BLUE])
        data = dict(name=operation_name, group='blue', adversary_id=adversary,
                    planner='batch', auto_close=True)
        await self.rest_svc.create_operation(access=access, data=data)
        return data

    async def _match_child_process(self, target_pid, link):
        autocollect_adv = self.get_service('response_svc').adversary.adversary_id
        for blue_op in [op for op in (await self.data_svc.locate('operations', match=dict(access=self.Access.BLUE)))
                        if op.adversary.adversary_id == autocollect_adv]:
            for lnk in blue_op.chain:
                if any(self._get_fact_value(lnk, trait) == target_pid for trait in
                       ['host.process.childid', 'host.process.grandchildid']) and \
                        self._get_fact_value(lnk, 'host.process.id'):
                    link.pin = int(self._get_fact_value(lnk, 'host.process.id'))
                    return str(link.pin)
        return None

    @staticmethod
    def _get_fact_value(link, trait):
        for fact in (link.facts + link.used):
            if fact.trait == trait:
                return fact.value
        return None
