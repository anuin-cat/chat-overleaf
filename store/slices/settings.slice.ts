import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { SettingsState, ModelConfig } from "../types"

const initialState: SettingsState = {
  apiKeys: {},
  baseUrls: {},
  selectedModel: null,
  initialized: false
}

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    // 设置 API Key
    setApiKey: (state, action: PayloadAction<{ provider: string; apiKey: string }>) => {
      state.apiKeys[action.payload.provider] = action.payload.apiKey
    },

    // 设置 Base URL
    setBaseUrl: (state, action: PayloadAction<{ provider: string; baseUrl: string }>) => {
      state.baseUrls[action.payload.provider] = action.payload.baseUrl
    },

    // 批量设置 API Keys
    setApiKeys: (state, action: PayloadAction<Record<string, string>>) => {
      state.apiKeys = { ...state.apiKeys, ...action.payload }
    },

    // 批量设置 Base URLs
    setBaseUrls: (state, action: PayloadAction<Record<string, string>>) => {
      state.baseUrls = { ...state.baseUrls, ...action.payload }
    },

    // 设置选中的模型
    setSelectedModel: (state, action: PayloadAction<ModelConfig>) => {
      state.selectedModel = action.payload
    },

    // 设置初始化状态
    setSettingsInitialized: (state, action: PayloadAction<boolean>) => {
      state.initialized = action.payload
    },

    // 重置设置
    resetSettings: (state) => {
      state.apiKeys = {}
      state.baseUrls = {}
      state.selectedModel = null
      state.initialized = false
    }
  }
})

export const {
  setApiKey,
  setBaseUrl,
  setApiKeys,
  setBaseUrls,
  setSelectedModel,
  setSettingsInitialized,
  resetSettings
} = settingsSlice.actions

export default settingsSlice.reducer
