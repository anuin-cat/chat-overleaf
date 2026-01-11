import { useSelector, useDispatch } from "react-redux"
import { useEffect } from "react"
import type { RootState, AppDispatch } from "~store"
import type { ModelConfig } from "~lib/builtin-models"
import { builtinProviders } from "~lib/providers"
import {
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
  setPinnedModels,
  toggleProviderEnabled,
  setProviderEnabled,
  setModelTemperature,
  setMaxTokens
} from "~store/slices/settings.slice"

export const useSettings = () => {
  const dispatch = useDispatch<AppDispatch>()
  const settingsState = useSelector((state: RootState) => state.settings)

  // 确保所有字段都有默认值，防止undefined错误
  const {
    apiKeys = {},
    baseUrls = {},
    selectedModel = null,
    initialized = false,
    customProviders = [],
    customModels = [],
    pinnedModels = [],
    settingsCategory = "model-service",
    enabledProviders = {},
    modelTemperature = 0.36,
    maxTokens = 16384
  } = settingsState || {}

  // 初始化设置 - 使用新的供应商配置系统
  const initializeSettings = () => {
    if (initialized) return

    // 从内置供应商配置中获取默认的 base URLs
    // 这样就不再依赖环境变量，而是使用固定的配置
    const defaultBaseUrls: Record<string, string> = {}

    // 使用内置供应商的配置
    // 注意：这里我们使用供应商的name作为key来保持向后兼容性
    const builtinProviders = [
      { name: '云雾', baseUrl: 'https://api.yunwu.ai/v1' },
      { name: '魔搭', baseUrl: 'https://api-inference.modelscope.cn/v1' },
      { name: '智谱AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
      { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
      { name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
    ]

    builtinProviders.forEach(provider => {
      defaultBaseUrls[provider.name] = provider.baseUrl
    })

    // 设置默认的 Base URLs
    dispatch(setBaseUrls(defaultBaseUrls))
    dispatch(setSettingsInitialized(true))
  }

  // 获取模型配置 - 现在所有模型都已经有完整配置，直接返回即可
  const getModelConfig = (model: ModelConfig): ModelConfig => {
    // 所有模型（内置和自定义）现在都通过统一的方式获取配置
    // 在 useModels 中已经处理了配置合并，这里直接返回
    return model
  }

  // 检查模型是否可用（有 API key 和 base URL）
  const isModelAvailable = (model: ModelConfig): boolean => {
    const config = getModelConfig(model)
    const available = !!(config.api_key && config.base_url)

    return available
  }

  // 检查供应商是否启用
  const isProviderEnabled = (providerId: string): boolean => {
    // 默认所有供应商都是启用的，除非明确设置为false
    return enabledProviders[providerId] !== false
  }

  return {
    // 状态
    apiKeys,
    baseUrls,
    selectedModel,
    initialized,
    customProviders,
    customModels,
    pinnedModels,
    settingsCategory,
    enabledProviders,
    modelTemperature,
    maxTokens,

    // 方法
    setApiKey: (provider: string, apiKey: string) =>
      dispatch(setApiKey({ provider, apiKey })),
    setBaseUrl: (provider: string, baseUrl: string) =>
      dispatch(setBaseUrl({ provider, baseUrl })),
    setSelectedModel: (model: ModelConfig) =>
      dispatch(setSelectedModel(model)),
    resetSettings: () => dispatch(resetSettings()),
    setSettingsCategory: (category: string) =>
      dispatch(setSettingsCategory(category)),
    addCustomProvider: (provider: any) =>
      dispatch(addCustomProvider(provider)),
    removeCustomProvider: (id: string) =>
      dispatch(removeCustomProvider(id)),
    updateCustomProvider: (provider: any) =>
      dispatch(updateCustomProvider(provider)),
    addCustomModel: (model: any) =>
      dispatch(addCustomModel(model)),
    removeCustomModel: (id: string) =>
      dispatch(removeCustomModel(id)),
    updateCustomModel: (model: any) =>
      dispatch(updateCustomModel(model)),
    toggleModelPin: (modelId: string) =>
      dispatch(toggleModelPin(modelId)),
    setPinnedModels: (modelIds: string[]) =>
      dispatch(setPinnedModels(modelIds)),
    toggleProviderEnabled: (providerId: string) =>
      dispatch(toggleProviderEnabled(providerId)),
    setProviderEnabled: (providerId: string, enabled: boolean) =>
      dispatch(setProviderEnabled({ providerId, enabled })),
    setModelTemperature: (value: number) =>
      dispatch(setModelTemperature(value)),
    setMaxTokens: (value: number) =>
      dispatch(setMaxTokens(value)),
    isProviderEnabled,
    initializeSettings,
    getModelConfig,
    isModelAvailable
  }
}
