import glob
import os

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


async def expansion(services):
    data_svc = services.get('data_svc')
    await _apply_hidden_access_to_loaded_files(data_svc)


async def _apply_hidden_access_to_loaded_files(data_svc):
    object_types = ['abilities', 'adversaries']
    for obj_typ in object_types:
        for filename in glob.iglob('plugins/gameboard/data/'+obj_typ+'/**/*.yml', recursive=True):
            obj_id = os.path.splitext(os.path.basename(filename))[0]
            if obj_typ == 'abilities':
                match = dict(ability_id=obj_id)
            else:
                match = dict(adversary_id=obj_id)
            objects = await data_svc.locate(obj_typ, match=match)
            for obj in objects:
                obj.access = BaseWorld.Access.HIDDEN
