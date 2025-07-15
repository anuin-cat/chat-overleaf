import { useSelector, useDispatch } from "react-redux"
import type { RootState, AppDispatch } from "~store"
import { toggleTheme, setTheme } from "~store/slices/ui.slice"

export const useUI = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { theme } = useSelector((state: RootState) => state.ui)

  // 主题相关
  const handleToggleTheme = () => {
    dispatch(toggleTheme())
  }

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    dispatch(setTheme(newTheme))
  }

  // 计算属性
  const isDarkMode = theme === 'dark'

  return {
    // 状态
    theme,

    // 计算属性
    isDarkMode,

    // 方法
    toggleTheme: handleToggleTheme,
    setTheme: handleSetTheme
  }
}
