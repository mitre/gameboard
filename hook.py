from app.utility.base_world import BaseWorld
from plugins.gameboard.app.gameboard_api import GameboardApi
from plugins.gameboard.app.gameboard_svc import GameboardService

name = 'GameBoard'
description = 'Monitor a red-and-blue team operation'
address = '/plugin/gameboard/gui'


async def enable(services):
    BaseWorld.apply_config('gameboard', BaseWorld.strip_yml('plugins/gameboard/conf/gameboard.yml')[0])
    gameboard_svc = GameboardService(services)
    gameboard_api = GameboardApi(services)
    app = services.get('app_svc').application
    app.router.add_static('/gameboard', 'plugins/gameboard/static/', append_version=True)
    app.router.add_route('GET', '/plugin/gameboard/gui', gameboard_api.splash)
    app.router.add_route('POST', '/plugin/gameboard/pieces', gameboard_api.get_pieces)
    app.router.add_route('PUT', '/plugin/gameboard/pin', gameboard_api.update_pin)
    app.router.add_route('POST', '/plugin/gameboard/hidden', gameboard_api.create_hidden_red_operation)
    app.router.add_route('POST', '/plugin/gameboard/detection', gameboard_api.verify_detection)
