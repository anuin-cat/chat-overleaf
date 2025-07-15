import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AppState } from "../types"

const initialState: AppState = {
  initialized: false
}

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    // 设置初始化状态
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.initialized = action.payload
    }
  }
})

export const { setInitialized } = appSlice.actions
export default appSlice.reducer
