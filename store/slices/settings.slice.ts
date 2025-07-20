import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { SettingsState, CustomProvider, CustomModel } from "../types"
import type { ModelConfig } from "~lib/builtin-models"

const initialState: SettingsState = {
  apiKeys: {},
  baseUrls: {},
  selectedModel: null,
  initialized: false,
  customProviders: [],
  customModels: [],
  pinnedModels: [],
  settingsCategory: "model-service"
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
      state.customProviders = []
      state.customModels = []
      state.pinnedModels = []
      state.settingsCategory = "model-service"
    },

    // 设置当前设置分类
    setSettingsCategory: (state, action: PayloadAction<string>) => {
      state.settingsCategory = action.payload
    },

    // 添加自定义供应商
    addCustomProvider: (state, action: PayloadAction<CustomProvider>) => {
      if (!state.customProviders) {
        state.customProviders = []
      }
      state.customProviders.push(action.payload)
    },

    // 删除自定义供应商
    removeCustomProvider: (state, action: PayloadAction<string>) => {
      if (!state.customProviders) {
        state.customProviders = []
      }
      if (!state.customModels) {
        state.customModels = []
      }
      state.customProviders = state.customProviders.filter(p => p.id !== action.payload)
      // 同时删除该供应商下的所有自定义模型
      state.customModels = state.customModels.filter(m => m.providerId !== action.payload)
    },

    // 更新自定义供应商
    updateCustomProvider: (state, action: PayloadAction<CustomProvider>) => {
      const index = state.customProviders.findIndex(p => p.id === action.payload.id)
      if (index !== -1) {
        state.customProviders[index] = action.payload
      }
    },

    // 添加自定义模型
    addCustomModel: (state, action: PayloadAction<CustomModel>) => {
      if (!state.customModels) {
        state.customModels = []
      }
      state.customModels.push(action.payload)
    },

    // 删除自定义模型
    removeCustomModel: (state, action: PayloadAction<string>) => {
      if (!state.customModels) {
        state.customModels = []
      }
      if (!state.pinnedModels) {
        state.pinnedModels = []
      }
      state.customModels = state.customModels.filter(m => m.id !== action.payload)
      // 从置顶列表中移除
      state.pinnedModels = state.pinnedModels.filter(id => id !== action.payload)
    },

    // 更新自定义模型
    updateCustomModel: (state, action: PayloadAction<CustomModel>) => {
      if (!state.customModels) {
        state.customModels = []
      }
      const index = state.customModels.findIndex(m => m.id === action.payload.id)
      if (index !== -1) {
        state.customModels[index] = action.payload
      }
    },

    // 切换模型置顶状态
    toggleModelPin: (state, action: PayloadAction<string>) => {
      const modelId = action.payload
      // 确保 pinnedModels 是数组
      if (!state.pinnedModels) {
        state.pinnedModels = []
      }
      const index = state.pinnedModels.indexOf(modelId)
      if (index === -1) {
        state.pinnedModels.push(modelId)
      } else {
        state.pinnedModels.splice(index, 1)
      }
    },

    // 设置置顶模型列表
    setPinnedModels: (state, action: PayloadAction<string[]>) => {
      state.pinnedModels = action.payload
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
  resetSettings,
  setSettingsCategory,
  addCustomProvider,
  removeCustomProvider,
  updateCustomProvider,
  addCustomModel,
  removeCustomModel,
  updateCustomModel,
  toggleModelPin,
  setPinnedModels
} = settingsSlice.actions

export default settingsSlice.reducer
