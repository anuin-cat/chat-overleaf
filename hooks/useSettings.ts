import { useSelector, useDispatch } from "react-redux"
import { useEffect } from "react"
import type { RootState, AppDispatch } from "~store"
import type { ModelConfig } from "~store/types"
import {
  setApiKey,
  setBaseUrl,
  setApiKeys,
  setBaseUrls,
  setSelectedModel,
  setSettingsInitialized,
  resetSettings
} from "~store/slices/settings.slice"

export const useSettings = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { apiKeys, baseUrls, selectedModel, initialized } = useSelector(
    (state: RootState) => state.settings
  )

  // 初始化设置 - 只加载默认的 Base URLs，不加载 API Keys
  const initializeSettings = () => {
    if (initialized) return

    // 只从环境变量获取默认的 base URLs，不获取 API keys
    const defaultBaseUrls: Record<string, string> = {}

    // 硅基流动
    if (process.env.PLASMO_PUBLIC_BASE_URL_SC) {
      defaultBaseUrls['硅基流动'] = process.env.PLASMO_PUBLIC_BASE_URL_SC
    }

    // DeepSeek
    if (process.env.PLASMO_PUBLIC_BASE_URL_DS) {
      defaultBaseUrls['DeepSeek'] = process.env.PLASMO_PUBLIC_BASE_URL_DS
    }

    // 云雾
    if (process.env.PLASMO_PUBLIC_BASE_URL_YW) {
      defaultBaseUrls['云雾'] = process.env.PLASMO_PUBLIC_BASE_URL_YW
    }

    // 通义千问
    if (process.env.PLASMO_PUBLIC_BASE_URL_AL) {
      defaultBaseUrls['阿里云'] = process.env.PLASMO_PUBLIC_BASE_URL_AL
    }

    // 智谱
    if (process.env.PLASMO_PUBLIC_BASE_URL_GLM) {
      defaultBaseUrls['智谱AI'] = process.env.PLASMO_PUBLIC_BASE_URL_GLM
    }

    // 只设置 Base URLs
    if (Object.keys(defaultBaseUrls).length > 0) {
      dispatch(setBaseUrls(defaultBaseUrls))
    }

    dispatch(setSettingsInitialized(true))
  }

  // 获取模型配置，只使用用户输入的值和默认 Base URL
  const getModelConfig = (model: ModelConfig): ModelConfig => {
    const providerApiKey = apiKeys[model.provider]
    const providerBaseUrl = baseUrls[model.provider]

    return {
      ...model,
      api_key: providerApiKey || "", // 只使用用户输入的 API key，不回退到默认值
      base_url: providerBaseUrl || model.base_url
    }
  }

  // 检查模型是否可用（有 API key 和 base URL）
  const isModelAvailable = (model: ModelConfig): boolean => {
    const config = getModelConfig(model)
    return !!(config.api_key && config.base_url)
  }

  return {
    // 状态
    apiKeys,
    baseUrls,
    selectedModel,
    initialized,

    // 方法
    setApiKey: (provider: string, apiKey: string) => 
      dispatch(setApiKey({ provider, apiKey })),
    setBaseUrl: (provider: string, baseUrl: string) => 
      dispatch(setBaseUrl({ provider, baseUrl })),
    setSelectedModel: (model: ModelConfig) => 
      dispatch(setSelectedModel(model)),
    resetSettings: () => dispatch(resetSettings()),
    initializeSettings,
    getModelConfig,
    isModelAvailable
  }
}
