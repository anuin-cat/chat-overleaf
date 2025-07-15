import { useSelector, useDispatch } from "react-redux"
import type { RootState, AppDispatch } from "~store"
import { login, logout, setLoading, setError } from "~store/slices/auth.slice"
import type { User } from "~store/types"

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { isLoggedIn, user, token, loading, error } = useSelector(
    (state: RootState) => state.auth
  )

  // 登录
  const handleLogin = (user: User, token: string) => {
    dispatch(login({ user, token }))
  }

  // 登出
  const handleLogout = () => {
    dispatch(logout())
  }

  // 设置加载状态
  const handleSetLoading = (loading: boolean) => {
    dispatch(setLoading(loading))
  }

  // 设置错误
  const handleSetError = (error: string | null) => {
    dispatch(setError(error))
  }

  return {
    // 状态
    isLoggedIn,
    user,
    token,
    loading,
    error,

    // 方法
    login: handleLogin,
    logout: handleLogout,
    setLoading: handleSetLoading,
    setError: handleSetError
  }
}
