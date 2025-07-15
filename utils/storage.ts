// 存储相关工具函数
import { Storage } from "@plasmohq/storage"

// 创建存储实例
const storage = new Storage()

// 存储键名常量
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  AUTH_TOKEN: 'auth_token',
  THEME: 'theme'
} as const

// 通用存储操作
export const storageUtils = {
  // 设置值
  set: async <T>(key: string, value: T): Promise<void> => {
    try {
      await storage.set(key, value)
    } catch (error) {
      console.error(`Failed to set storage key ${key}:`, error)
    }
  },

  // 获取值
  get: async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
    try {
      const value = await storage.get(key)
      return value !== undefined ? value : defaultValue
    } catch (error) {
      console.error(`Failed to get storage key ${key}:`, error)
      return defaultValue
    }
  },

  // 删除值
  remove: async (key: string): Promise<void> => {
    try {
      await storage.remove(key)
    } catch (error) {
      console.error(`Failed to remove storage key ${key}:`, error)
    }
  },

  // 清空所有存储
  clear: async (): Promise<void> => {
    try {
      await storage.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }
}
