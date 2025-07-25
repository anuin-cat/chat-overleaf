import { configureStore } from "@reduxjs/toolkit"
import { localStorage } from "redux-persist-webextension-storage"
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

const persistConfig = {
  key: "chat-overleaf",
  version: 1,
  storage: localStorage,
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
  new Storage().watch({
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
