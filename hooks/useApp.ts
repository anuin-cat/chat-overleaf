import { useSelector, useDispatch } from "react-redux"
import type { RootState, AppDispatch } from "~store"
import { setInitialized } from "~store/slices/app.slice"

export const useApp = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { initialized } = useSelector((state: RootState) => state.app)
  
  // 设置初始化状态
  const handleSetInitialized = (value: boolean) => {
    dispatch(setInitialized(value))
  }
  
  return {
    // 状态
    initialized,
    
    // 方法
    setInitialized: handleSetInitialized
  }
}
