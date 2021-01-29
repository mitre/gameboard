from app.utility.base_world import BaseWorld
from plugins.gameboard.app.gameboard_api import GameboardApi
from plugins.gameboard.app.gameboard_svc import GameboardService
from plugins.gameboard.test.test_processtree import create_test_processtree_and_ops

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
    app.router.add_route('POST', '/plugin/gameboard/pin', gameboard_api.update_pin)
    app.router.add_route('POST', '/plugin/gameboard/analytic', gameboard_api.analytic)
    app.router.add_route('POST', '/plugin/gameboard/detection', gameboard_api.verify_detection)


async def expansion(services):
    data_svc = services.get('data_svc')
    await _apply_hidden_access_to_loaded_files(data_svc)
    test_processtree, agent, red_op, blue_op = await create_test_processtree_and_ops()
    planner = (await services.get('data_svc').locate('planners', match=dict(name='atomic')))[0]
    red_op.planner = planner
    blue_op.planner = planner
    await data_svc.store(test_processtree)
    await data_svc.store(agent)
    await data_svc.store(red_op)
    await data_svc.store(blue_op)


async def _apply_hidden_access_to_loaded_files(data_svc):
    objects_to_hide = dict(abilities=[
                                      '4a9b51ba-1a0d-4128-a040-5535fd147dc3',
                                      '0df4d46e-e202-4b29-9a19-c2540982002d',
                                     ],
                           adversaries=['7d1794bb-d7ce-4fe8-bae0-6959fa0a0a48'])
    for obj_type in ['abilities', 'adversaries']:
        for obj_id in objects_to_hide[obj_type]:
            if obj_type == 'abilities':
                match = dict(ability_id=obj_id)
            else:
                match = dict(adversary_id=obj_id)
            objects = await data_svc.locate(obj_type, match=match)
            for obj in objects:
                obj.access = BaseWorld.Access.HIDDEN
