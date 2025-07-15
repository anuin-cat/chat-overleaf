import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { UIState } from "../types"

const initialState: UIState = {
  theme: 'light'
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    // 切换主题
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light'
    },

    // 设置主题
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
    }
  }
})

export const { toggleTheme, setTheme } = uiSlice.actions
export default uiSlice.reducer
