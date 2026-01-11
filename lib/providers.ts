import type { CustomProvider } from "~store/types"

// 内置供应商配置 - 固定的baseUrl配置
export const builtinProviders: CustomProvider[] = [
  {
    id: "yunwu",
    name: "云雾",
    baseUrl: "https://yunwu.ai/v1",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: true
  },
  {
    id: "modelscope",
    name: "魔搭",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: true
  },
  {
    id: "zhipu",
    name: "智谱AI",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: false
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: false
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: false
  },
  {
    id: "OpenAI 官方",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: false
  },
  {
    id: "Gemini 官方",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: false
  },
  {
    id: "Anthropic 官方",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyLabel: "API Key",
    isCustom: false,
    enabled: false
  },
]

// 根据ID获取供应商
export const getProviderById = (id: string, customProviders: CustomProvider[] = []): CustomProvider | undefined => {
  // 先在内置供应商中查找
  const builtinProvider = builtinProviders.find(p => p.id === id)
  if (builtinProvider) return builtinProvider
  
  // 再在自定义供应商中查找
  return customProviders.find(p => p.id === id)
}

// 获取所有供应商（内置 + 自定义）
export const getAllProviders = (customProviders: CustomProvider[] = []): CustomProvider[] => {
  return [...builtinProviders, ...customProviders]
}

// 根据名称获取供应商（兼容旧版本）
export const getProviderByName = (name: string, customProviders: CustomProvider[] = []): CustomProvider | undefined => {
  const allProviders = getAllProviders(customProviders)
  return allProviders.find(p => p.name === name)
}
