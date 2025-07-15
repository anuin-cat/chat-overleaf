export interface ModelConfig {
  model_name: string
  base_url: string
  api_key: string
  display_name: string
  provider: string
  free?: boolean
}

// 从环境变量获取配置
// Plasmo 支持 .env.local 文件，但环境变量必须以 PLASMO_PUBLIC_ 前缀
const getEnvVar = (key: string): string => {
  return process.env[key] || ""
}

// 硅基流动模型配置
export const siliconFlowModels: ModelConfig[] = [
  {
    model_name: "THUDM/GLM-4-32B-0414",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_SC"),
    display_name: "GLM-4-32B",
    provider: "硅基流动"
  },
  {
    model_name: "THUDM/GLM-Z1-32B-0414",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_SC"),
    display_name: "GLM-Z1-32B",
    provider: "硅基流动"
  },
  {
    model_name: "Qwen/Qwen3-30B-A3B",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_SC"),
    display_name: "Qwen3-30B-A3B",
    provider: "硅基流动",
    free: true
  },
  {
    model_name: "Qwen/Qwen3-235B-A22B",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_SC"),
    display_name: "Qwen3-235B-A22B",
    provider: "硅基流动",
    free: true
  },
  {
    model_name: "Qwen/Qwen3-14B",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_SC"),
    display_name: "Qwen3-14B",
    provider: "硅基流动",
    free: true
  },
  {
    model_name: "Qwen/Qwen3-32B",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_SC"),
    display_name: "Qwen3-32B",
    provider: "硅基流动",
    free: true
  }
]

// DeepSeek 模型配置
export const deepSeekModels: ModelConfig[] = [
  {
    model_name: "deepseek-chat",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_DS"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_DS"),
    display_name: "DeepSeek Chat",
    provider: "DeepSeek"
  }
]

// 云雾模型配置
export const yunwuModels: ModelConfig[] = [
  {
    model_name: "gpt-4o-mini",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_YW_GPT"),
    display_name: "GPT-4o Mini",
    provider: "云雾"
  },
  {
    model_name: "claude-3-5-sonnet-20241022",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_YW_Claude"),
    display_name: "Claude-3.5 Sonnet",
    provider: "云雾"
  },
  {
    model_name: "gemini-1.5-pro",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_YW_GEMINI"),
    display_name: "Gemini-1.5 Pro",
    provider: "云雾"
  }
]

// 通义千问模型配置
export const qwenModels: ModelConfig[] = [
  {
    model_name: "qwen-turbo",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_AL"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_AL"),
    display_name: "通义千问 Turbo",
    provider: "阿里云"
  },
  {
    model_name: "qwen-plus",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_AL"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_AL"),
    display_name: "通义千问 Plus",
    provider: "阿里云"
  }
]

// 智谱模型配置
export const glmModels: ModelConfig[] = [
  {
    model_name: "glm-4-flash",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_GLM"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_GLM"),
    display_name: "GLM-4 Flash",
    provider: "智谱AI",
    free: true
  },
  {
    model_name: "glm-4-plus",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_GLM"),
    api_key: getEnvVar("PLASMO_PUBLIC_API_KEY_GLM"),
    display_name: "GLM-4 Plus",
    provider: "智谱AI"
  }
]

// 所有可用模型
export const allModels: ModelConfig[] = [
  ...siliconFlowModels,
  ...deepSeekModels,
  ...yunwuModels,
  ...qwenModels,
  ...glmModels
]

// 默认模型
export const defaultModel = siliconFlowModels[2] // Qwen3-30B-A3B (免费)
