import { useMemo } from "react"
import { useSettings } from "./useSettings"
import { builtinModels, getModelUniqueId } from "~lib/builtin-models"
import { getAllProviders } from "~lib/providers"
import type { ModelConfig, BaseModelConfig } from "~lib/builtin-models"
import type { CustomModel } from "~store/types"

// 扩展的模型配置，包含置顶和自定义标识
export interface ExtendedModelConfig extends ModelConfig {
  id: string // 唯一标识符
  isPinned: boolean
  isCustom: boolean
  providerDisplayName: string
}

export const useModels = () => {
  const {
    customModels = [],
    customProviders = [],
    pinnedModels = [],
    apiKeys = {},
    baseUrls = {},
    getModelConfig,
    isModelAvailable,
    toggleModelPin,
    isProviderEnabled
  } = useSettings()

  const allProviders = getAllProviders(customProviders)

  // 将内置模型转换为扩展模型配置
  const extendedBuiltinModels: ExtendedModelConfig[] = useMemo(() => {
    return builtinModels.map((baseModel) => {
      const provider = allProviders.find(p => p.name === baseModel.provider)
      if (!provider) return null

      // 使用新的唯一标识符：供应商::模型名称
      const modelId = getModelUniqueId(baseModel)

      // 内置模型现在也通过供应商获取配置，和自定义模型保持一致
      const modelConfig: ModelConfig = {
        ...baseModel,
        base_url: provider.baseUrl,
        api_key: apiKeys[provider.name] || apiKeys[provider.id] || "", // 兼容新旧key格式
      }

      return {
        ...modelConfig,
        id: modelId,
        isPinned: (pinnedModels || []).includes(modelId),
        isCustom: false,
        providerDisplayName: provider.name
      }
    }).filter(Boolean) as ExtendedModelConfig[]
  }, [builtinModels, allProviders, pinnedModels, apiKeys])

  // 将自定义模型转换为扩展模型配置
  const extendedCustomModels: ExtendedModelConfig[] = useMemo(() => {
    return customModels.map((customModel) => {
      const provider = allProviders.find(p => p.id === customModel.providerId)
      if (!provider) return null

      const modelConfig: ModelConfig = {
        model_name: customModel.modelName,
        base_url: provider.baseUrl,
        api_key: apiKeys[provider.name] || apiKeys[provider.id] || "", // 兼容新旧key格式
        display_name: customModel.displayName,
        provider: provider.name,
        multimodal: false, // 默认值，可以后续扩展
        api_format: 'openai' // 默认值，可以后续扩展
      }

      // 使用存储的ID，而不是重新生成
      const modelId = customModel.id

      return {
        ...modelConfig,
        id: modelId,
        isPinned: (pinnedModels || []).includes(modelId),
        isCustom: true,
        providerDisplayName: provider.name
      }
    }).filter(Boolean) as ExtendedModelConfig[]
  }, [customModels, allProviders, pinnedModels, apiKeys])

  // 合并所有模型
  const allModels: ExtendedModelConfig[] = useMemo(() => {
    return [...extendedBuiltinModels, ...extendedCustomModels]
  }, [extendedBuiltinModels, extendedCustomModels])

  // 按置顶状态和名称排序
  const sortedModels: ExtendedModelConfig[] = useMemo(() => {
    return [...allModels].sort((a, b) => {
      // 置顶的模型排在前面
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      
      // 同样置顶状态下按名称排序
      return a.display_name.localeCompare(b.display_name)
    })
  }, [allModels])

  // 获取可用的模型（有API key且供应商已启用的）
  const availableModels: ExtendedModelConfig[] = useMemo(() => {
    return sortedModels.filter(model => {
      const modelConfig = getModelConfig(model)
      // 检查模型是否可用（有API key）
      if (!isModelAvailable(modelConfig)) return false

      // 检查供应商是否启用
      if (model.isCustom) {
        // 自定义模型：检查自定义供应商是否启用
        const customModel = customModels.find(cm => cm.id === model.id)
        if (customModel) {
          return isProviderEnabled(customModel.providerId)
        }
      } else {
        // 内置模型：检查内置供应商是否启用
        const provider = allProviders.find(p => p.name === model.provider)
        if (provider) {
          return isProviderEnabled(provider.id)
        }
      }

      return true // 如果找不到供应商信息，默认显示
    })
  }, [sortedModels, getModelConfig, isModelAvailable, isProviderEnabled, customModels, allProviders])

  // 根据ID获取模型
  const getModelById = (id: string): ExtendedModelConfig | undefined => {
    return allModels.find(model => model.id === id)
  }

  // 切换模型置顶状态
  const handleTogglePin = (modelId: string) => {
    toggleModelPin(modelId)
  }

  // 获取模型的完整配置（包含API key等）
  const getFullModelConfig = (model: ExtendedModelConfig): ModelConfig => {
    return getModelConfig(model)
  }

  return {
    allModels,
    sortedModels,
    availableModels,
    getModelById,
    handleTogglePin,
    getFullModelConfig,
    isModelAvailable: (model: ExtendedModelConfig) => {
      const modelConfig = getModelConfig(model)
      return isModelAvailable(modelConfig)
    }
  }
}
