// 基础模型配置接口（用于内置模型定义）
export interface BaseModelConfig {
  model_name: string
  display_name: string
  provider: string
  free?: boolean
  // 多模态相关配置
  multimodal?: boolean
  image_resolution_threshold?: number
  // API格式类型
  api_format?: 'openai' | 'gemini' | 'claude'
}

// 完整模型配置接口（包含运行时配置）
export interface ModelConfig extends BaseModelConfig {
  base_url: string
  api_key: string
}

// 内置模型配置 - 只包含模型基本信息，运行时配置通过供应商获取
export const builtinModels: BaseModelConfig[] = [
  // 硅基流动模型
  {
    model_name: "moonshotai/Kimi-K2-Instruct",
    display_name: "Kimi-K2",
    provider: "硅基流动",
    multimodal: false,
  },
  {
    model_name: "deepseek-ai/DeepSeek-V3",
    display_name: "DeepSeek-V3",
    provider: "硅基流动",
    multimodal: false,
  },
  {
    model_name: "deepseek-ai/DeepSeek-R1",
    display_name: "DeepSeek-R1",
    provider: "硅基流动",
    multimodal: false,
  },
  {
    model_name: "Qwen/Qwen3-235B-A22B",
    display_name: "Qwen3-235B-A22B",
    provider: "硅基流动",
    multimodal: false,
  },

  // DeepSeek 官方模型
  {
    model_name: "deepseek-chat",
    display_name: "DeepSeek-V3",
    provider: "DeepSeek",
    multimodal: false,
  },
  {
    model_name: "deepseek-reasoner",
    display_name: "DeepSeek-R1",
    provider: "DeepSeek",
    multimodal: false,
  },

  // Google Gemini 模型
  {
    model_name: "gemini-2.5-pro",
    display_name: "Gemini 2.5 Pro",
    provider: "Gemini 官方",
    multimodal: true,
    api_format: "openai",
  },
  {
    model_name: "gemini-2.5-flash",
    display_name: "Gemini 2.5 Flash",
    provider: "Gemini 官方",
    multimodal: true,
    api_format: "openai",
  },

  // 云雾模型
  {
    model_name: "gemini-2.5-flash",
    display_name: "gemini-2.5-flash",
    provider: "云雾",
    multimodal: false,
  },
  {
    model_name: "gemini-2.5-pro",
    display_name: "gemini-2.5-pro",
    provider: "云雾",
    multimodal: false,
  },
  {
    model_name: "gpt-4.1-2025-04-14",
    display_name: "gpt-4.1",
    provider: "云雾",
    multimodal: false,
  },
  {
    model_name: "o4-mini",
    display_name: "o4-mini",
    provider: "云雾",
    multimodal: false,
  },
  {
    model_name: "claude-3-5-sonnet-20240620",
    display_name: "Claude-3.5-Sonnet",
    provider: "云雾",
    multimodal: false,
  },
]

// 生成模型的唯一标识符（供应商 + 模型名称）
export const getModelUniqueId = (model: BaseModelConfig): string => {
  return `${model.provider}::${model.model_name}`
}

// 默认模型的唯一标识符
export const DEFAULT_MODEL_ID = "硅基流动::moonshotai/Kimi-K2-Instruct"

// 默认模型（基础配置）
export const defaultBaseModel = builtinModels.find(m => getModelUniqueId(m) === DEFAULT_MODEL_ID) || builtinModels[0]
