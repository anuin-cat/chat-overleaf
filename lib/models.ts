export interface ModelConfig {
  model_name: string
  base_url: string
  api_key: string
  display_name: string
  provider: string
  free?: boolean
}

// 创建模型配置的工厂函数
export const createModelConfig = (
  model_name: string,
  display_name: string,
  provider: string,
  envKeyPrefix: string,
  free?: boolean
): ModelConfig => ({
  model_name,
  display_name,
  provider,
  free,
  base_url: getEnvVar(`PLASMO_PUBLIC_BASE_URL_${envKeyPrefix}`) || "",
  api_key: "" // 不从环境变量加载 API key，只使用用户输入
})

// 从环境变量获取配置
// Plasmo 支持 .env.local 文件，但环境变量必须以 PLASMO_PUBLIC_ 前缀
const getEnvVar = (key: string): string => {
  const value = process.env[key] || ""
  console.log(`Environment variable ${key}:`, value ? "✓ Found" : "✗ Not found", value ? `(${value.substring(0, 10)}...)` : "")
  return value
}

// 硅基流动模型配置
export const siliconFlowModels: ModelConfig[] = [
  {
    model_name: "moonshotai/Kimi-K2-Instruct",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: "",
    display_name: "Kimi-K2",
    provider: "硅基流动",
  },
  {
    model_name: "deepseek-ai/DeepSeek-V3",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: "",
    display_name: "DeepSeek-V3",
    provider: "硅基流动",
  },
  {
    model_name: "Qwen/Qwen3-235B-A22B",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: "",
    display_name: "Qwen3-235B-A22B",
    provider: "硅基流动",
  },
]

// DeepSeek 模型配置
export const deepSeekModels: ModelConfig[] = [
  {
    model_name: "deepseek-chat",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_DS"),
    api_key: "",
    display_name: "DeepSeek Chat",
    provider: "DeepSeek"
  }
]

// 云雾模型配置
export const yunwuModels: ModelConfig[] = [
  {
    model_name: "gpt-4.1-2025-04-14",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "gpt-4.1",
    provider: "云雾"
  },
  {
    model_name: "gpt-4.1-mini-2025-04-14",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "gpt-4.1-mini",
    provider: "云雾"
  },
]

// 所有可用模型
export const allModels: ModelConfig[] = [
  ...yunwuModels,
  ...siliconFlowModels,
  ...deepSeekModels,
]

// 默认模型
export const defaultModel = yunwuModels[1] // gpt-4.1
