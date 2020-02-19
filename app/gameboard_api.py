from aiohttp import web
from aiohttp_jinja2 import template

from app.service.auth_svc import check_authorization
from app.utility.base_service import BaseService


class GameboardApi(BaseService):

    def __init__(self, services):
        self.auth_svc = services.get('auth_svc')
        self.data_svc = services.get('data_svc')

    @check_authorization
    @template('gameboard.html')
    async def splash(self, request):
        red_ops = await self.data_svc.locate('operations', dict(access=self.Access.RED))
        blue_ops = await self.data_svc.locate('operations', dict(access=self.Access.BLUE))
        return dict(red_ops=red_ops, blue_ops=blue_ops)

    @check_authorization
    async def get_pieces(self, request):
        data = dict(await request.json())
        red_ops = await self.data_svc.locate('operations', dict(id=data.get('red')))
        blue_ops = await self.data_svc.locate('operations', dict(id=data.get('blue')))
        pieces = [l for op in red_ops + blue_ops for l in op.chain if l.finish]
        response = dict(blue_state=blue_ops[0].state if blue_ops else 'n/a',
                        red_state=red_ops[0].state if red_ops else 'n/a',
                        links=[p.display for p in sorted(pieces, key=lambda i: i.finish)])
        return web.json_response(response)
