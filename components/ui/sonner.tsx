import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'

// Toast 类型定义
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
  success: (message: string, options?: Partial<Toast>) => void
  error: (message: string, options?: Partial<Toast>) => void
  warning: (message: string, options?: Partial<Toast>) => void
  info: (message: string, options?: Partial<Toast>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// Toast 样式配置
const toastStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  default: 'bg-white border-gray-200 text-gray-800'
}

// 单个 Toast 组件
const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ 
  toast, 
  onDismiss 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // 进入动画
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // 自动消失
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, toast.duration || 2000)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  const handleDismiss = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => {
      onDismiss(toast.id)
    }, 300) // 等待退出动画完成
  }, [toast.id, onDismiss])

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
        ${toastStyles[toast.type]}
        border rounded-lg shadow-lg p-3 mb-2 min-w-[200px] max-w-[400px]
        relative group cursor-pointer
      `}
      onClick={handleDismiss}
    >
      {/* 关闭按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleDismiss()
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>

      {/* 内容 */}
      <div className="pr-6">
        {toast.title && (
          <div className="font-medium text-sm mb-1">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-xs opacity-90">{toast.description}</div>
        )}
      </div>
    </div>
  )
}

// Toast 容器组件
const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext)
  if (!context) return null

  const { toasts, dismiss } = context
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    // 监听侧边栏状态变化
    const checkSidebarState = () => {
      // 检查侧边栏是否显示
      const sidebar = document.querySelector('[class*="fixed"][class*="right-0"][class*="h-full"]')
      const isVisible = !!sidebar
      setShowChat(isVisible)

      // 获取侧边栏宽度
      if (sidebar) {
        const width = sidebar.getBoundingClientRect().width
        if (width > 0) {
          setSidebarWidth(width)
        }
      }
    }

    // 初始检查
    checkSidebarState()

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(checkSidebarState)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    return () => observer.disconnect()
  }, [])

  if (toasts.length === 0) return null

  // 计算容器位置
  const containerStyle = showChat ? {
    position: 'fixed' as const,
    top: '16px',
    right: `${sidebarWidth / 2}px`,
    transform: 'translateX(50%)',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center'
  } : {
    position: 'fixed' as const,
    top: '16px',
    right: '16px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'end'
  }

  return (
    <div style={containerStyle}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}

// Toast Provider 组件
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((toastData: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 11)
    const newToast: Toast = {
      id,
      duration: 2000,
      ...toastData
    }
    setToasts(prev => [...prev, newToast])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((message: string, options?: Partial<Toast>) => {
    toast({
      type: 'success',
      description: message,
      ...options
    })
  }, [toast])

  const error = useCallback((message: string, options?: Partial<Toast>) => {
    toast({
      type: 'error',
      description: message,
      ...options
    })
  }, [toast])

  const warning = useCallback((message: string, options?: Partial<Toast>) => {
    toast({
      type: 'warning',
      description: message,
      ...options
    })
  }, [toast])

  const info = useCallback((message: string, options?: Partial<Toast>) => {
    toast({
      type: 'info',
      description: message,
      ...options
    })
  }, [toast])

  const contextValue: ToastContextType = {
    toasts,
    toast,
    dismiss,
    success,
    error,
    warning,
    info
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// Hook 用于使用 toast
export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// 导出便捷函数
export const toast = {
  success: (_message: string, _options?: Partial<Toast>) => {
    // 这个需要在组件外部使用时通过全局实例调用
    console.warn('toast.success called outside of component context')
  },
  error: (_message: string, _options?: Partial<Toast>) => {
    console.warn('toast.error called outside of component context')
  },
  warning: (_message: string, _options?: Partial<Toast>) => {
    console.warn('toast.warning called outside of component context')
  },
  info: (_message: string, _options?: Partial<Toast>) => {
    console.warn('toast.info called outside of component context')
  }
}
