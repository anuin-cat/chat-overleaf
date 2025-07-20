// Redux相关类型定义
export interface User {
  id: string
  name: string
  email: string
}

export interface AuthState {
  isLoggedIn: boolean
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
}

export interface AppState {
  // 应用状态的基本结构，可以根据需要扩展
  initialized: boolean
}

export interface UIState {
  theme: 'light' | 'dark'
}

// 自定义供应商配置
export interface CustomProvider {
  id: string
  name: string // 既是内部名称也是显示名称
  baseUrl: string
  apiKeyLabel: string
  isCustom: boolean
}

// 自定义模型配置
export interface CustomModel {
  id: string
  modelName: string
  displayName: string
  providerId: string
  isCustom: boolean
}

export interface SettingsState {
  apiKeys: Record<string, string>
  baseUrls: Record<string, string>
  selectedModel: any | null // 使用 any 避免循环依赖，实际使用时从 lib/models 导入
  initialized: boolean
  // 新增字段
  customProviders: CustomProvider[]
  customModels: CustomModel[]
  pinnedModels: string[] // 存储置顶模型的ID
  settingsCategory: string // 当前选中的设置分类
}
