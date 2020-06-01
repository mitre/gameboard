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
        response = dict(access=self.BLUE_TEAM if self.Access.BLUE in access else self.RED_TEAM,
                        red_op_state=red_op[0].state if red_op else None,
                        blue_op_state=blue_op[0].state if blue_op else None,
                        exchanges=list(exchanges.items()),
                        points=self._get_points(red_op, blue_op, exchanges))
        return web.json_response(response)

    def _get_exchanges(self, red_ops, blue_ops):
        exchanges = dict()
        self._set_pins(blue_ops)
        exchanges = self._add_links_to_exchange(exchanges, self._get_sorted_links(red_ops), team=self.RED_TEAM)
        exchanges = self._add_links_to_exchange(exchanges, self._get_sorted_links(blue_ops), team=self.BLUE_TEAM)
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

    def _add_links_to_exchange(self, exchanges, links, team):
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

    def _get_points(self, red_op, blue_op, exchanges):
        red_points = 0
        blue_points = 0
        for exchange in exchanges.values():
            red_link_points = self._calc_red_link_points(blue_op, exchange)
            red_points += red_link_points[0]
            blue_points += red_link_points[1] + self._calc_blue_link_points(red_op, exchange)
        return [red_points, blue_points]

    def _calc_red_link_points(self, blue_op, exchange):
        blue_points = red_points = 0
        for red_link in exchange[self.RED_TEAM]:
            if blue_op:
                if len(exchange[self.BLUE_TEAM]) == 0:
                    blue_points -= self._adjust_blue_points(red_link)
                else:
                    continue
            red_points += self._add_points(red_link, self.RED_POINT_MAPPING)
        return red_points, blue_points

    def _calc_blue_link_points(self, red_op, exchange):
        blue_points = 0
        for blue_link in exchange[self.BLUE_TEAM]:
            if red_op and len(exchange[self.RED_TEAM]) == 0:
                blue_points -= 1
                continue
            blue_points += self._add_points(blue_link, self.BLUE_POINT_MAPPING)
        return blue_points

    @staticmethod
    def _add_points(link, mapping):
        if link['status'] != 0:
            return 0
        tactic = link['ability']['tactic']
        return mapping.get(tactic, 1)

    @staticmethod
    def _adjust_blue_points(red_link):
        if red_link['visibility']['score'] >= 50:
            return 2
        return 1
