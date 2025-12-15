import type { Ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { BuildQueueItem } from '@/types/game'
import * as buildingValidation from '@/logic/buildingValidation'
import * as resourceLogic from '@/logic/resourceLogic'
import * as researchValidation from '@/logic/researchValidation'

/**
 * 队列处理
 * 处理建造队列和研究队列的取消操作
 */
export const useQueueHandler = (
  t: (key: string) => string,
  confirmDialogOpen: Ref<boolean>,
  confirmDialogTitle: Ref<string>,
  confirmDialogMessage: Ref<string>,
  confirmDialogAction: Ref<(() => void) | null>
) => {
  const gameStore = useGameStore()

  /**
   * 取消建造
   */
  const handleCancelBuild = (queueId: string) => {
    confirmDialogTitle.value = t('queue.cancelBuild')
    confirmDialogMessage.value = t('queue.confirmCancel')
    confirmDialogAction.value = () => {
      if (!gameStore.currentPlanet) return false
      const { item, index } = buildingValidation.findQueueItem(gameStore.currentPlanet.buildQueue, queueId)
      if (!item) return false
      if (item.type === 'building') {
        const refund = buildingValidation.cancelBuildingUpgrade(gameStore.currentPlanet, item)
        resourceLogic.addResources(gameStore.currentPlanet.resources, refund)
      }
      gameStore.currentPlanet.buildQueue.splice(index, 1)
      return true
    }
    confirmDialogOpen.value = true
  }

  /**
   * 取消研究
   */
  const handleCancelResearch = (queueId: string) => {
    confirmDialogTitle.value = t('queue.cancelResearch')
    confirmDialogMessage.value = t('queue.confirmCancel')
    confirmDialogAction.value = () => {
      if (!gameStore.currentPlanet) return false
      const { item, index } = buildingValidation.findQueueItem(gameStore.player.researchQueue, queueId)
      if (!item) return false
      if (item.type === 'technology') {
        const refund = researchValidation.cancelTechnologyResearch(item)
        resourceLogic.addResources(gameStore.currentPlanet.resources, refund)
      }
      gameStore.player.researchQueue.splice(index, 1)
      return true
    }
    confirmDialogOpen.value = true
  }

  /**
   * 获取队列项名称
   */
  const getItemName = (item: BuildQueueItem): string => {
    if (item.type === 'building' || item.type === 'demolish') {
      const buildingName = t(`buildings.${item.itemType}`)
      return item.type === 'demolish' ? `${t('buildingsView.demolish')} - ${buildingName}` : buildingName
    } else if (item.type === 'technology') {
      return t(`technologies.${item.itemType}`)
    } else if (item.type === 'ship') {
      return t(`ships.${item.itemType}`)
    } else if (item.type === 'defense') {
      return t(`defenses.${item.itemType}`)
    }
    return t('common.unknown')
  }

  /**
   * 获取剩余时间（秒）
   */
  const getRemainingTime = (item: BuildQueueItem): number => {
    const now = Date.now()
    return Math.max(0, Math.floor((item.endTime - now) / 1000))
  }

  /**
   * 获取队列进度（百分比）
   */
  const getQueueProgress = (item: BuildQueueItem): number => {
    const now = Date.now()
    const total = item.endTime - item.startTime
    const elapsed = now - item.startTime
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  return {
    handleCancelBuild,
    handleCancelResearch,
    getItemName,
    getRemainingTime,
    getQueueProgress
  }
}
