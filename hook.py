import glob
import os

from app.utility.base_world import BaseWorld
from app.objects.c_ability import Ability
from app.objects.c_adversary import Adversary
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

    data_svc = services.get('data_svc')
    await _add_manual_detection_abilities_and_adversary(data_svc)


async def _add_manual_detection_abilities_and_adversary(data_svc):
    pid_ability = Ability(ability_id='4a9b51ba-1a0d-4128-a040-5535fd147dc3', tactic='verification', technique_id='x',
                          technique='x', name='GameBoard Plugin Manual Detection - PID', test='Ow==',
                          description='GameBoard plugin pid detection placeholder ability', platform='any',
                          executor='any', access=BaseWorld.Access.HIDDEN)
    guid_ability = Ability(ability_id='0df4d46e-e202-4b29-9a19-c2540982002d', tactic='verification', technique_id='x',
                           technique='x', name='GameBoard Plugin Manual Detection - GUID', test='Ow==',
                           description='GameBoard plugin guid detection placeholder ability', platform='any',
                           executor='any', access=BaseWorld.Access.HIDDEN)
    detection_adversary = Adversary(adversary_id='7d1794bb-d7ce-4fe8-bae0-6959fa0a0a48',
                                    name='Gameboard Plugin Manual Detection Placeholder Adversary',
                                    description='Empty adversary for gameboard manual detections operation',
                                    atomic_ordering=['4a9b51ba-1a0d-4128-a040-5535fd147dc3',
                                                     '0df4d46e-e202-4b29-9a19-c2540982002d'])
    detection_adversary.access = BaseWorld.Access.HIDDEN
    for obj in [pid_ability, guid_ability, detection_adversary]:
        await data_svc.store(obj)
