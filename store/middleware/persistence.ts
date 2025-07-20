import type { Middleware } from "@reduxjs/toolkit"
import type { RootState } from "../index"

// 存储键名
const STORAGE_KEY = "chat-overleaf-settings"

// 需要持久化的状态字段
const PERSISTED_FIELDS = [
  "apiKeys",
  "baseUrls", 
  "selectedModel",
  "customProviders",
  "customModels",
  "pinnedModels",
  "settingsCategory"
]

// 从localStorage加载状态
export const loadPersistedState = (): Partial<RootState["settings"]> | undefined => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY)
    if (serializedState === null) {
      return undefined
    }
    
    const parsedState = JSON.parse(serializedState)
    
    // 验证数据结构
    if (typeof parsedState !== "object" || parsedState === null) {
      return undefined
    }
    
    // 只返回需要持久化的字段
    const filteredState: any = {}
    PERSISTED_FIELDS.forEach(field => {
      if (parsedState[field] !== undefined) {
        filteredState[field] = parsedState[field]
      }
    })
    
    return filteredState
  } catch (err) {
    console.warn("Failed to load persisted state:", err)
    return undefined
  }
}

// 保存状态到localStorage
const saveState = (state: RootState["settings"]) => {
  try {
    // 只保存需要持久化的字段
    const stateToSave: any = {}
    PERSISTED_FIELDS.forEach(field => {
      if (state[field as keyof typeof state] !== undefined) {
        stateToSave[field] = state[field as keyof typeof state]
      }
    })
    
    const serializedState = JSON.stringify(stateToSave)
    localStorage.setItem(STORAGE_KEY, serializedState)
  } catch (err) {
    console.warn("Failed to save state:", err)
  }
}

// 持久化中间件
export const persistenceMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const result = next(action)
  
  // 只在settings相关的action后保存状态
  if (action.type.startsWith("settings/")) {
    const state = store.getState()
    saveState(state.settings)
  }
  
  return result
}

// 清除持久化数据
export const clearPersistedState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn("Failed to clear persisted state:", err)
  }
}
