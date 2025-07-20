export interface ModelConfig {
  model_name: string
  base_url: string
  api_key: string
  display_name: string
  provider: string
  free?: boolean
  // 多模态相关配置
  multimodal?: boolean
  image_resolution_threshold?: number
  // API格式类型
  api_format?: 'openai' | 'gemini' | 'claude'
}



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
    multimodal: false,
  },
  {
    model_name: "deepseek-ai/DeepSeek-V3",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: "",
    display_name: "DeepSeek-V3 (硅基)",
    provider: "硅基流动",
    multimodal: false,
  },
  {
    model_name: "deepseek-ai/DeepSeek-R1",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: "",
    display_name: "DeepSeek-R1 (硅基)",
    provider: "硅基流动",
    multimodal: false,
  },
  {
    model_name: "Qwen/Qwen3-235B-A22B",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_SC"),
    api_key: "",
    display_name: "Qwen3-235B-A22B",
    provider: "硅基流动",
    multimodal: false,
  },
]

// DeepSeek 模型配置
export const deepSeekModels: ModelConfig[] = [
  {
    model_name: "deepseek-chat",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_DS"),
    api_key: "",
    display_name: "DeepSeek-V3 (官方)",
    provider: "DeepSeek",
    multimodal: false,
  },
  {
    model_name: "deepseek-reasoner",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_DS"),
    api_key: "",
    display_name: "DeepSeek-R1 (官方)",
    provider: "DeepSeek",
    multimodal: false,
  }
]

// 云雾模型配置
export const yunwuModels: ModelConfig[] = [
  {
    model_name: "gemini-2.5-flash",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "gemini-2.5-flash",
    provider: "云雾",
    multimodal: true,
    image_resolution_threshold: 1024,
    api_format: 'openai',
  },
  {
    model_name: "gemini-2.5-pro",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "gemini-2.5-pro",
    provider: "云雾",
    multimodal: true,
    image_resolution_threshold: 1024,
    api_format: 'openai',
  },
  {
    model_name: "gpt-4.1-2025-04-14",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "gpt-4.1",
    provider: "云雾",
    multimodal: true,
    image_resolution_threshold: 1024,
    api_format: 'openai',
  },
  {
    model_name: "o4-mini",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "o4-mini",
    provider: "云雾",
    multimodal: true,
    image_resolution_threshold: 1024,
    api_format: 'openai',
  },
  {
    model_name: "claude-3-5-sonnet-20240620",
    base_url: getEnvVar("PLASMO_PUBLIC_BASE_URL_YW"),
    api_key: "",
    display_name: "Claude-3.5-Sonnet",
    provider: "云雾",
    multimodal: true,
    image_resolution_threshold: 1024,
    api_format: 'openai',
  },
]

// 所有可用模型
export const allModels: ModelConfig[] = [
  ...siliconFlowModels,
  ...yunwuModels,
  ...deepSeekModels,
]

// 默认模型
export const defaultModel = yunwuModels[1] // gpt-4.1-mini