import { useGameStore } from '@/stores/gameStore'
import { useUniverseStore } from '@/stores/universeStore'
import { useNPCStore } from '@/stores/npcStore'
import type { FleetMission } from '@/types/game'
import { MissionType } from '@/types/game'
import * as gameLogic from '@/logic/gameLogic'
import * as fleetLogic from '@/logic/fleetLogic'
import * as shipLogic from '@/logic/shipLogic'
import * as resourceLogic from '@/logic/resourceLogic'
import * as diplomaticLogic from '@/logic/diplomaticLogic'

/**
 * 舰队任务处理
 * 处理玩家舰队任务的到达和返回
 */
export const useMissionHandler = (t: (key: string) => string) => {
  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const npcStore = useNPCStore()

  /**
   * 处理任务到达
   */
  const processMissionArrival = async (mission: FleetMission) => {
    // 从宇宙星球地图中查找目标星球
    const targetKey = gameLogic.generatePositionKey(
      mission.targetPosition.galaxy,
      mission.targetPosition.system,
      mission.targetPosition.position
    )
    // 先从玩家星球中查找，再从宇宙地图中查找
    const targetPlanet =
      gameStore.player.planets.find(
        p =>
          p.position.galaxy === mission.targetPosition.galaxy &&
          p.position.system === mission.targetPosition.system &&
          p.position.position === mission.targetPosition.position
      ) || universeStore.planets[targetKey]

    // 获取起始星球名称（用于报告）
    const originPlanet = gameStore.player.planets.find(p => p.id === mission.originPlanetId)
    const originPlanetName = originPlanet?.name || t('fleetView.unknownPlanet')

    if (mission.missionType === MissionType.Transport) {
      const result = fleetLogic.processTransportArrival(mission, targetPlanet, gameStore.player, npcStore.npcs)
      // 生成运输任务报告
      if (!gameStore.player.missionReports) {
        gameStore.player.missionReports = []
      }
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Transport,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName:
          targetPlanet?.name || `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`,
        success: result.success,
        message: result.success ? t('missionReports.transportSuccess') : t('missionReports.transportFailed'),
        details: {
          transportedResources: mission.cargo
        },
        read: false
      })
    } else if (mission.missionType === MissionType.Attack) {
      const attackResult = await fleetLogic.processAttackArrival(mission, targetPlanet, gameStore.player, null, gameStore.player.planets)
      if (attackResult) {
        gameStore.player.battleReports.push(attackResult.battleResult)

        // 检查是否攻击了NPC星球，更新外交关系
        if (targetPlanet) {
          const targetNpc = npcStore.npcs.find(npc => npc.planets.some(p => p.id === targetPlanet.id))
          if (targetNpc) {
            diplomaticLogic.handleAttackReputation(gameStore.player, targetNpc, attackResult.battleResult, npcStore.npcs)
          }
        }

        if (attackResult.moon) {
          gameStore.player.planets.push(attackResult.moon)
        }
        if (attackResult.debrisField) {
          // 将残骸场添加到游戏状态
          universeStore.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
        }
      }
    } else if (mission.missionType === MissionType.Colonize) {
      const newPlanet = fleetLogic.processColonizeArrival(mission, targetPlanet, gameStore.player, t('planet.colonyPrefix'))
      // 生成殖民任务报告
      if (!gameStore.player.missionReports) {
        gameStore.player.missionReports = []
      }
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Colonize,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: newPlanet?.id,
        targetPlanetName: newPlanet?.name,
        success: !!newPlanet,
        message: newPlanet ? t('missionReports.colonizeSuccess') : t('missionReports.colonizeFailed'),
        details: newPlanet
          ? {
              newPlanetId: newPlanet.id,
              newPlanetName: newPlanet.name
            }
          : undefined,
        read: false
      })
      if (newPlanet) {
        gameStore.player.planets.push(newPlanet)
      }
    } else if (mission.missionType === MissionType.Spy) {
      const spyReport = fleetLogic.processSpyArrival(mission, targetPlanet, gameStore.player, null, npcStore.npcs)
      if (spyReport) gameStore.player.spyReports.push(spyReport)
    } else if (mission.missionType === MissionType.Deploy) {
      const deployed = fleetLogic.processDeployArrival(mission, targetPlanet, gameStore.player.id)
      // 生成部署任务报告
      if (!gameStore.player.missionReports) {
        gameStore.player.missionReports = []
      }
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Deploy,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName:
          targetPlanet?.name || `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`,
        success: deployed,
        message: deployed ? t('missionReports.deploySuccess') : t('missionReports.deployFailed'),
        details: {
          deployedFleet: mission.fleet
        },
        read: false
      })
      if (deployed) {
        const missionIndex = gameStore.player.fleetMissions.indexOf(mission)
        if (missionIndex > -1) gameStore.player.fleetMissions.splice(missionIndex, 1)
        return
      }
    } else if (mission.missionType === MissionType.Recycle) {
      // 处理回收任务
      const debrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
      const debrisField = universeStore.debrisFields[debrisId]
      const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)

      // 生成回收任务报告
      if (!gameStore.player.missionReports) {
        gameStore.player.missionReports = []
      }
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Recycle,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        success: !!recycleResult,
        message: recycleResult ? t('missionReports.recycleSuccess') : t('missionReports.recycleFailed'),
        details: recycleResult
          ? {
              recycledResources: recycleResult.collectedResources,
              remainingDebris: recycleResult.remainingDebris || undefined
            }
          : undefined,
        read: false
      })

      if (recycleResult && debrisField) {
        if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
          // 更新残骸场
          universeStore.debrisFields[debrisId] = {
            id: debrisField.id,
            position: debrisField.position,
            resources: recycleResult.remainingDebris,
            createdAt: debrisField.createdAt,
            expiresAt: debrisField.expiresAt
          }
        } else {
          // 残骸场已被完全收集，删除
          delete universeStore.debrisFields[debrisId]
        }
      }
    } else if (mission.missionType === MissionType.Destroy) {
      // 处理行星毁灭任务
      const destroyResult = fleetLogic.processDestroyArrival(mission, targetPlanet, gameStore.player)

      // 生成毁灭任务报告
      if (!gameStore.player.missionReports) {
        gameStore.player.missionReports = []
      }
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Destroy,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName: targetPlanet?.name,
        success: destroyResult?.success || false,
        message: destroyResult?.success ? t('missionReports.destroySuccess') : t('missionReports.destroyFailed'),
        details: destroyResult?.success
          ? {
              destroyedPlanetName:
                targetPlanet?.name ||
                `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`
            }
          : undefined,
        read: false
      })

      if (destroyResult && destroyResult.success && destroyResult.planetId) {
        // 星球被摧毁
        // 从玩家星球列表中移除（如果是玩家的星球）
        const planetIndex = gameStore.player.planets.findIndex(p => p.id === destroyResult.planetId)
        if (planetIndex > -1) {
          gameStore.player.planets.splice(planetIndex, 1)
        } else {
          // 不是玩家星球，从宇宙地图中移除
          delete universeStore.planets[targetKey]
        }
      }
    }
  }

  /**
   * 处理任务返回
   */
  const processMissionReturn = (mission: FleetMission) => {
    const originPlanet = gameStore.player.planets.find(p => p.id === mission.originPlanetId)
    if (!originPlanet) return
    shipLogic.addFleet(originPlanet.fleet, mission.fleet)
    resourceLogic.addResources(originPlanet.resources, mission.cargo)
    const missionIndex = gameStore.player.fleetMissions.indexOf(mission)
    if (missionIndex > -1) gameStore.player.fleetMissions.splice(missionIndex, 1)
  }

  return {
    processMissionArrival,
    processMissionReturn
  }
}
