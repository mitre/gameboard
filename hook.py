from plugins.gameboard.app.gameboard_api import GameboardApi

name = 'GameBoard'
description = 'Monitor a red-and-blue team operation'
address = '/plugin/gameboard/gui'


async def enable(services):
    gameboard_api = GameboardApi(services)
    app = services.get('app_svc').application
    app.router.add_static('/gameboard', 'plugins/gameboard/static/', append_version=True)
    app.router.add_route('GET', '/plugin/gameboard/gui', gameboard_api.splash)
    app.router.add_route('POST', '/plugin/gameboard/pieces', gameboard_api.get_pieces)
    app.router.add_route('PUT', '/plugin/gameboard/pin', gameboard_api.update_pin)
