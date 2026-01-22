// 存储相关工具函数
import { Storage } from "@plasmohq/storage"
import { chatHistoryStorage } from "./indexeddb-storage"

// 创建存储实例
const storage = new Storage()

// 需要使用大容量存储的键名
const LARGE_STORAGE_KEYS = ['chat_history']
const LARGE_STORAGE_PREFIXES = ['overleaf_file_cache:']

const isLargeStorageKey = (key: string) =>
  LARGE_STORAGE_KEYS.includes(key) || LARGE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))

// 初始化大容量存储
let indexedDBInitialized = false
const initIndexedDB = async () => {
  if (!indexedDBInitialized) {
    try {
      await chatHistoryStorage.init()
      indexedDBInitialized = true
      console.log('IndexedDB initialized for large storage')
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error)
    }
  }
}



// 通用存储操作
export const storageUtils = {
  // 设置值（智能选择存储方式）
  set: async <T>(key: string, value: T): Promise<void> => {
    // 如果是大容量数据，使用 IndexedDB
    if (isLargeStorageKey(key)) {
      try {
        await initIndexedDB()
        await chatHistoryStorage.set(key, value)
        console.log(`Saved ${key} to IndexedDB`)
        return
      } catch (error) {
        console.error(`Failed to save ${key} to IndexedDB:`, error)
        // 如果 IndexedDB 失败，降级到 chrome.storage
        console.warn('Falling back to chrome.storage')
      }
    }

    // 使用默认的 chrome.storage
    try {
      await storage.set(key, value)
    } catch (error) {
      console.error(`Failed to set storage key ${key}:`, error)

      // 如果是配额超限错误，尝试清理旧数据
      if (error.message && error.message.includes('quota exceeded')) {
        console.warn('Storage quota exceeded, attempting to clean up old data...')

        // 如果是聊天历史，尝试清理
        if (key === 'chat_history') {
          await cleanupChatHistory()
          // 重试保存
          try {
            await storage.set(key, value)
            console.log('Successfully saved after cleanup')
          } catch (retryError) {
            console.error('Failed to save even after cleanup:', retryError)
            throw retryError
          }
        } else {
          throw error
        }
      } else {
        throw error
      }
    }
  },

  // 获取值（智能选择存储方式）
  get: async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
    // 如果是大容量数据，优先从 IndexedDB 获取
    if (isLargeStorageKey(key)) {
      try {
        await initIndexedDB()
        const value = await chatHistoryStorage.get<T>(key)
        if (value !== undefined) {
          return value
        }
        // 如果 IndexedDB 中没有，尝试从 chrome.storage 迁移
        console.log(`No data in IndexedDB for ${key}, checking chrome.storage for migration`)
      } catch (error) {
        console.error(`Failed to get ${key} from IndexedDB:`, error)
      }
    }

    // 从默认的 chrome.storage 获取
    try {
      const value = await storage.get(key)

      // 如果是大容量数据且在 chrome.storage 中找到了，迁移到 IndexedDB
      if (isLargeStorageKey(key) && value !== undefined && indexedDBInitialized) {
        try {
          await chatHistoryStorage.set(key, value)
          console.log(`Migrated ${key} from chrome.storage to IndexedDB`)
          // 可选：从 chrome.storage 中删除以节省空间
          // await storage.remove(key)
        } catch (migrationError) {
          console.error(`Failed to migrate ${key} to IndexedDB:`, migrationError)
        }
      }

      return (value !== undefined ? value : defaultValue) as T | undefined
    } catch (error) {
      console.error(`Failed to get storage key ${key}:`, error)
      return defaultValue
    }
  },

  // 删除值（智能选择存储方式）
  remove: async (key: string): Promise<void> => {
    // 如果是大容量数据，从 IndexedDB 删除
    if (isLargeStorageKey(key)) {
      try {
        await initIndexedDB()
        await chatHistoryStorage.remove(key)
      } catch (error) {
        console.error(`Failed to remove ${key} from IndexedDB:`, error)
      }
    }

    // 同时从 chrome.storage 删除
    try {
      await storage.remove(key)
    } catch (error) {
      console.error(`Failed to remove storage key ${key}:`, error)
    }
  },

  // 清空所有存储
  clear: async (): Promise<void> => {
    // 清空 IndexedDB
    try {
      await initIndexedDB()
      await chatHistoryStorage.clear()
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error)
    }

    // 清空 chrome.storage
    try {
      await storage.clear()
    } catch (error) {
      console.error('Failed to clear chrome.storage:', error)
    }
  },

  // 获取存储使用情况
  getStorageInfo: async () => {
    const estimate = await chatHistoryStorage.getStorageEstimate()
    return {
      indexedDB: estimate,
      chromeStorage: 'Not available' // Chrome storage API 不提供使用量查询
    }
  }
}

// 清理聊天历史的函数
const cleanupChatHistory = async (): Promise<void> => {
  try {
    // 优先从 IndexedDB 清理
    let histories: any[] = []

    if (indexedDBInitialized) {
      try {
        histories = await chatHistoryStorage.get('chat_history') || []
      } catch (error) {
        console.error('Failed to get chat history from IndexedDB:', error)
      }
    }

    // 如果 IndexedDB 中没有数据，从 chrome.storage 获取
    if (histories.length === 0) {
      histories = await storage.get('chat_history') || []
    }

    if (Array.isArray(histories) && histories.length > 0) {
      // 按最后更新时间排序，保留最新的 166 条记录
      const sortedHistories = histories
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
        .slice(0, 166)

      console.log(`Cleaned up chat history: ${histories.length} -> ${sortedHistories.length}`)

      // 保存到合适的存储位置
      if (indexedDBInitialized) {
        await chatHistoryStorage.set('chat_history', sortedHistories)
      } else {
        await storage.set('chat_history', sortedHistories)
      }
    }
  } catch (error) {
    console.error('Failed to cleanup chat history:', error)
  }
}
