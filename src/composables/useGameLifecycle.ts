import { useGameStore } from '@/stores/gameStore'
import { useUniverseStore } from '@/stores/universeStore'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import * as resourceLogic from '@/logic/resourceLogic'
import * as officerLogic from '@/logic/officerLogic'

/**
 * 游戏生命周期管理
 * 处理游戏初始化、NPC星球生成等
 */
export const useGameLifecycle = () => {
  const gameStore = useGameStore()
  const universeStore = useUniverseStore()

  /**
   * 生成NPC星球
   */
  const generateNPCPlanets = (npcCount: number, planetPrefix: string) => {
    for (let i = 0; i < npcCount; i++) {
      const position = gameLogic.generateRandomPosition()
      const key = gameLogic.generatePositionKey(position.galaxy, position.system, position.position)
      if (universeStore.planets[key]) continue
      const npcPlanet = planetLogic.createNPCPlanet(i, position, planetPrefix)
      universeStore.planets[key] = npcPlanet
    }
  }

  /**
   * 初始化游戏
   */
  const initGame = async (playerName: string, homePlanetName: string, planetPrefix: string) => {
    const shouldInit = gameLogic.shouldInitializeGame(gameStore.player.planets)

    if (!shouldInit) {
      const now = Date.now()

      // 计算离线收益（直接同步计算）
      const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
      gameStore.player.planets.forEach(planet => {
        resourceLogic.updatePlanetResources(planet, now, bonuses)
      })

      // 只在没有NPC星球时才生成（首次加载已有玩家数据时）
      if (Object.keys(universeStore.planets).length === 0) {
        generateNPCPlanets(200, planetPrefix)
      }
      return
    }

    gameStore.player = gameLogic.initializePlayer(gameStore.player.id, playerName)
    const initialPlanet = planetLogic.createInitialPlanet(gameStore.player.id, homePlanetName)
    gameStore.player.planets = [initialPlanet]
    gameStore.currentPlanetId = initialPlanet.id
    // 新玩家初始化时生成NPC星球
    generateNPCPlanets(200, planetPrefix)
  }

  return {
    initGame,
    generateNPCPlanets
  }
}
