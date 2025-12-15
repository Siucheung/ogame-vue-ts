import { useGameStore } from '@/stores/gameStore'
import { useNPCStore } from '@/stores/npcStore'
import type { FleetMission } from '@/types/game'
import * as gameLogic from '@/logic/gameLogic'

/**
 * 游戏更新循环
 * 处理游戏状态的定期更新
 */
export const useGameUpdate = (
  processMissionArrival: (mission: FleetMission) => Promise<void>,
  processMissionReturn: (mission: FleetMission) => void,
  processNPCMissionArrival: (npc: any, mission: FleetMission) => void,
  processNPCMissionReturn: (npc: any, mission: FleetMission) => void,
  updateNPCGrowth: (deltaSeconds: number) => void,
  updateNPCBehavior: (deltaSeconds: number) => void
) => {
  const gameStore = useGameStore()
  const npcStore = useNPCStore()

  /**
   * 游戏主更新函数
   */
  const updateGame = () => {
    if (gameStore.isPaused) return
    const now = Date.now()
    gameStore.gameTime = now

    // 检查军官过期
    gameLogic.checkOfficersExpiration(gameStore.player.officers, now)

    // 处理游戏更新（建造队列、研究队列等）
    const result = gameLogic.processGameUpdate(gameStore.player, now)
    gameStore.player.researchQueue = result.updatedResearchQueue

    // 处理舰队任务
    gameStore.player.fleetMissions.forEach(mission => {
      if (mission.status === 'outbound' && now >= mission.arrivalTime) {
        processMissionArrival(mission)
      } else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
        processMissionReturn(mission)
      }
    })

    // 处理NPC舰队任务
    npcStore.npcs.forEach(npc => {
      if (npc.fleetMissions) {
        npc.fleetMissions.forEach(mission => {
          if (mission.status === 'outbound' && now >= mission.arrivalTime) {
            processNPCMissionArrival(npc, mission)
          } else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
            processNPCMissionReturn(npc, mission)
          }
        })
      }
    })

    // NPC成长系统更新
    updateNPCGrowth(1) // 传入1秒的时间间隔

    // NPC行为系统更新（侦查和攻击决策）
    updateNPCBehavior(1)
  }

  return {
    updateGame
  }
}
