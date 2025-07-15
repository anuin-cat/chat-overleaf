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

// 登录凭据类型
export interface LoginCredentials {
  username: string
  password: string
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
