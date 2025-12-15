import { useGameStore } from '@/stores/gameStore'
import { useUniverseStore } from '@/stores/universeStore'
import { useNPCStore } from '@/stores/npcStore'
import type { NPC, FleetMission, IncomingFleetAlert } from '@/types/game'
import { MissionType } from '@/types/game'
import * as gameLogic from '@/logic/gameLogic'
import * as fleetLogic from '@/logic/fleetLogic'
import * as shipLogic from '@/logic/shipLogic'
import * as npcGrowthLogic from '@/logic/npcGrowthLogic'
import * as npcBehaviorLogic from '@/logic/npcBehaviorLogic'

/**
 * NPC处理
 * 处理NPC舰队任务、成长系统、行为系统
 */
export const useNPCHandler = () => {
  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const npcStore = useNPCStore()

  /**
   * 移除即将到来的舰队警告
   */
  const removeIncomingFleetAlert = (alert: IncomingFleetAlert) => {
    if (!gameStore.player.incomingFleetAlerts) return
    const index = gameStore.player.incomingFleetAlerts.indexOf(alert)
    if (index > -1) {
      gameStore.player.incomingFleetAlerts.splice(index, 1)
    }
  }

  /**
   * 根据任务ID移除即将到来的舰队警告
   */
  const removeIncomingFleetAlertById = (missionId: string) => {
    if (!gameStore.player.incomingFleetAlerts) return
    const index = gameStore.player.incomingFleetAlerts.findIndex(a => a.id === missionId)
    if (index > -1) {
      gameStore.player.incomingFleetAlerts.splice(index, 1)
    }
  }

  /**
   * 处理NPC任务到达
   */
  const processNPCMissionArrival = (npc: NPC, mission: FleetMission) => {
    if (mission.missionType === MissionType.Recycle) {
      // NPC回收任务到达
      const debrisId = mission.debrisFieldId
      if (!debrisId) {
        console.warn('[NPC Mission] Recycle mission missing debrisFieldId')
        mission.status = 'returning'
        mission.returnTime = Date.now() + (mission.arrivalTime - mission.departureTime)
        return
      }

      const debrisField = universeStore.debrisFields[debrisId]
      const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)

      if (recycleResult && debrisField) {
        if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
          // 更新残骸场
          universeStore.debrisFields[debrisId] = {
            id: debrisField.id,
            position: debrisField.position,
            resources: recycleResult.remainingDebris,
            createdAt: debrisField.createdAt
          }
        } else {
          // 残骸已被完全回收，从宇宙中删除
          delete universeStore.debrisFields[debrisId]
        }
      }

      // 移除即将到来的警告（回收任务已到达）
      removeIncomingFleetAlertById(mission.id)

      // 设置返回时间
      mission.returnTime = Date.now() + (mission.arrivalTime - mission.departureTime)
      return
    }

    // 找到目标星球
    const targetKey = gameLogic.generatePositionKey(
      mission.targetPosition.galaxy,
      mission.targetPosition.system,
      mission.targetPosition.position
    )
    const targetPlanet =
      gameStore.player.planets.find(
        p =>
          p.position.galaxy === mission.targetPosition.galaxy &&
          p.position.system === mission.targetPosition.system &&
          p.position.position === mission.targetPosition.position
      ) || universeStore.planets[targetKey]

    if (!targetPlanet) {
      console.warn('[NPC Mission] Target planet not found')
      return
    }

    if (mission.missionType === MissionType.Spy) {
      // NPC侦查到达
      const { spiedNotification, spyReport } = npcBehaviorLogic.processNPCSpyArrival(npc, mission, targetPlanet, gameStore.player)

      // 保存侦查报告到NPC（用于后续攻击决策）
      if (!npc.playerSpyReports) {
        npc.playerSpyReports = {}
      }
      npc.playerSpyReports[targetPlanet.id] = spyReport

      // 添加被侦查通知给玩家
      if (!gameStore.player.spiedNotifications) {
        gameStore.player.spiedNotifications = []
      }
      gameStore.player.spiedNotifications.push(spiedNotification)

      // 移除即将到来的警告（侦查已到达）
      removeIncomingFleetAlertById(mission.id)
    } else if (mission.missionType === MissionType.Attack) {
      // NPC攻击到达 - 使用专门的NPC攻击处理逻辑
      fleetLogic.processNPCAttackArrival(npc, mission, targetPlanet, gameStore.player, gameStore.player.planets).then(attackResult => {
        if (attackResult) {
          // 添加战斗报告给玩家
          gameStore.player.battleReports.push(attackResult.battleResult)

          // 如果生成月球，添加到玩家星球列表
          if (attackResult.moon) {
            gameStore.player.planets.push(attackResult.moon)
          }

          // 如果生成残骸场，添加到宇宙残骸场列表
          if (attackResult.debrisField) {
            universeStore.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
          }
        }

        // 移除即将到来的警告（攻击已到达）
        removeIncomingFleetAlertById(mission.id)
      })
    }
  }

  /**
   * 处理NPC任务返回
   */
  const processNPCMissionReturn = (npc: NPC, mission: FleetMission) => {
    // 找到NPC的起始星球
    const originPlanet = npc.planets.find(p => p.id === mission.originPlanetId)
    if (!originPlanet) return

    // 返还舰队
    shipLogic.addFleet(originPlanet.fleet, mission.fleet)

    // 如果携带掠夺资源，给NPC添加资源
    if (mission.cargo) {
      originPlanet.resources.metal += mission.cargo.metal
      originPlanet.resources.crystal += mission.cargo.crystal
      originPlanet.resources.deuterium += mission.cargo.deuterium
    }

    // 从NPC任务列表中移除
    if (npc.fleetMissions) {
      const missionIndex = npc.fleetMissions.indexOf(mission)
      if (missionIndex > -1) {
        npc.fleetMissions.splice(missionIndex, 1)
      }
    }
  }

  // NPC成长系统更新
  let npcUpdateCounter = 0
  const NPC_UPDATE_INTERVAL = 10

  /**
   * 更新NPC成长系统
   */
  const updateNPCGrowth = (deltaSeconds: number) => {
    // 累积时间
    npcUpdateCounter += deltaSeconds

    // 只在达到更新间隔时才执行
    if (npcUpdateCounter < NPC_UPDATE_INTERVAL) {
      return
    }

    // 获取所有星球
    const allPlanets = Object.values(universeStore.planets)

    // 如果NPC store为空，从星球数据中初始化NPC
    if (npcStore.npcs.length === 0) {
      const npcMap = new Map<string, any>()

      allPlanets.forEach(planet => {
        // 跳过玩家的星球
        if (planet.ownerId === gameStore.player.id || !planet.ownerId) return

        // 这是NPC的星球
        if (!npcMap.has(planet.ownerId)) {
          npcMap.set(planet.ownerId, {
            id: planet.ownerId,
            name: `NPC-${planet.ownerId.substring(0, 8)}`,
            planets: [],
            technologies: {},
            difficulty: 'medium' as const,
            relations: {},
            allies: [],
            enemies: []
          })
        }

        npcMap.get(planet.ownerId)!.planets.push(planet)
      })

      // 保存到store
      npcStore.npcs = Array.from(npcMap.values())

      // 如果有NPC，基于玩家实力初始化NPC
      if (npcStore.npcs.length > 0) {
        const gameState: npcGrowthLogic.NPCGrowthGameState = {
          planets: allPlanets,
          player: gameStore.player,
          npcs: npcStore.npcs
        }

        const playerPower = npcGrowthLogic.calculatePlayerAveragePower(gameState)

        npcStore.npcs.forEach(npc => {
          npcGrowthLogic.initializeNPCStartingPower(npc, playerPower)
        })

        // 初始化NPC之间的外交关系（盟友/敌人）
        npcGrowthLogic.initializeNPCDiplomacy(npcStore.npcs)
      }
    }

    // 如果没有NPC，直接返回
    if (npcStore.npcs.length === 0) {
      npcUpdateCounter = 0
      return
    }

    // 构建游戏状态
    const gameState: npcGrowthLogic.NPCGrowthGameState = {
      planets: allPlanets,
      player: gameStore.player,
      npcs: npcStore.npcs
    }

    // 使用累积的时间更新每个NPC
    npcStore.npcs.forEach(npc => {
      npcGrowthLogic.updateNPCGrowth(npc, gameState, npcUpdateCounter)
    })

    // 重置计数器
    npcUpdateCounter = 0
  }

  // NPC行为系统更新
  let npcBehaviorCounter = 0
  const NPC_BEHAVIOR_INTERVAL = 5

  /**
   * 更新NPC行为系统
   */
  const updateNPCBehavior = (deltaSeconds: number) => {
    // 累积时间
    npcBehaviorCounter += deltaSeconds

    // 只在达到更新间隔时才执行
    if (npcBehaviorCounter < NPC_BEHAVIOR_INTERVAL) {
      return
    }

    // 如果没有NPC，直接返回
    if (npcStore.npcs.length === 0) {
      npcBehaviorCounter = 0
      return
    }

    const now = Date.now()
    const allPlanets = Object.values(universeStore.planets)

    // 更新每个NPC的行为
    npcStore.npcs.forEach(npc => {
      npcBehaviorLogic.updateNPCBehavior(npc, gameStore.player, allPlanets, universeStore.debrisFields, now)
    })

    npcBehaviorCounter = 0
  }

  return {
    processNPCMissionArrival,
    processNPCMissionReturn,
    removeIncomingFleetAlert,
    removeIncomingFleetAlertById,
    updateNPCGrowth,
    updateNPCBehavior
  }
}
