import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AuthState, User } from "../types"

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  token: null,
  loading: false,
  error: null
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // 登录
    login: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.isLoggedIn = true
      state.user = action.payload.user
      state.token = action.payload.token
      state.error = null
    },

    // 登出
    logout: (state) => {
      state.isLoggedIn = false
      state.user = null
      state.token = null
      state.error = null
    },

    // 设置加载状态
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },

    // 设置错误
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    }
  }
})

export const { login, logout, setLoading, setError } = authSlice.actions
export default authSlice.reducer
