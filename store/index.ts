import { configureStore } from "@reduxjs/toolkit"
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  RESYNC,
  persistReducer,
  persistStore
} from "@plasmohq/redux-persist"
import { Storage } from "@plasmohq/storage"

import rootReducer from "./slices"

// 统一使用扩展级别的 chrome.storage.local，避免在不同域名下出现隔离的页面 localStorage
const plasmoStorage = new Storage({ area: "local" })
const extensionStorage = {
  getItem: async (key: string) => {
    const value = await plasmoStorage.get<string>(key)
    return value ?? null
  },
  setItem: (key: string, value: string) => plasmoStorage.set(key, value),
  removeItem: (key: string) => plasmoStorage.remove(key),
  getAllKeys: async () => {
    // 获取所有存储的键，用于 redux-persist
    // 使用 chrome.storage.local API 直接获取所有键
    return new Promise<string[]>((resolve) => {
      chrome.storage.local.get(null, (items) => {
        resolve(Object.keys(items))
      })
    })
  }
}

const persistConfig = {
  key: "chat-overleaf",
  version: 1,
  storage: extensionStorage,
  // 只持久化这些切片
  whitelist: ['auth', 'app', 'settings']
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          FLUSH,
          REHYDRATE,
          PAUSE,
          PERSIST,
          PURGE,
          REGISTER,
          RESYNC
        ]
      }
    })
})

export const persistor = persistStore(store)

// 这是关键：让Redux在多个页面间同步
// 当chrome.storage中的数据变化时，自动重新同步store
try {
  plasmoStorage.watch({
    [`persist:${persistConfig.key}`]: () => {
      try {
        persistor.resync()
      } catch (error) {
        console.error('Failed to resync persistor:', error)
      }
    }
  })
} catch (error) {
  console.error('Failed to setup storage watch:', error)
}

// 导出类型，供hooks使用
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
