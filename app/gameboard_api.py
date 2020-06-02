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

    def __init__(self, services):
        self.auth_svc = services.get('auth_svc')
        self.data_svc = services.get('data_svc')
        self.app_svc = services.get('app_svc')

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
        response = dict(access=self.BLUE_TEAM if self.Access.BLUE in access else self.RED_TEAM,
                        red_op=red_op[0].display if red_op else None,
                        blue_op=blue_op[0].display if blue_op else None,
                        exchanges=self._get_exchanges(red_op, blue_op))
        return web.json_response(response)

    async def update_pin(self, request):
        data = dict(await request.json())
        link = await self.app_svc.find_link(data['link_id'])
        link.pin = int(data['updated_pin'])
        return web.json_response('completed')

    def _get_exchanges(self, red_ops, blue_ops):
        exchanges = dict()
        self._set_pins(blue_ops)
        exchanges = self._add_links_to_exchange(exchanges, self._get_sorted_links(red_ops), team=self.RED_TEAM)
        exchanges = self._add_links_to_exchange(exchanges, self._get_sorted_links(blue_ops), team=self.BLUE_TEAM)
        return list(exchanges.items())

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
