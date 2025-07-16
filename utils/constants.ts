// 应用常量定义

// 应用信息
export const APP_INFO = {
  NAME: 'Chat Overleaf',
  VERSION: '0.0.1',
  DESCRIPTION: '使用 plasmo 构建的 chat-overleaf 浏览器插件'
} as const

// API相关常量
export const API_CONFIG = {
  BASE_URL: process.env.PLASMO_PUBLIC_API_URL || 'https://api.example.com',
  TIMEOUT: 10000
} as const

// 存储相关常量
export const STORAGE_CONFIG = {
  PREFIX: 'chat-overleaf',
  VERSION: 1,
  PERSIST_KEY: 'chat-overleaf'
} as const

// UI相关常量
export const UI_CONFIG = {
  THEMES: ['light', 'dark'] as const,
  DEFAULT_THEME: 'light' as const
} as const

// 错误消息
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器错误，请稍后重试',
  UNKNOWN_ERROR: '未知错误，请联系技术支持'
} as const
