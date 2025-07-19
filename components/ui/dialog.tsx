import React, { createContext, useContext, useState, useCallback } from 'react'
import { Button } from './button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './card'
import { X } from 'lucide-react'

// 对话框类型定义
export interface DialogOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogContextType | null>(null)

// 对话框状态接口
interface DialogState extends DialogOptions {
  isOpen: boolean
  resolve?: (value: boolean) => void
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: '确认',
    cancelText: '取消',
    variant: 'default'
  })

  const showDialog = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title || '确认操作',
        description: options.description || '您确定要执行此操作吗？',
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        variant: options.variant || 'default',
        resolve
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(true)
    }
    setDialogState(prev => ({ ...prev, isOpen: false, resolve: undefined }))
  }, [dialogState.resolve])

  const handleCancel = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(false)
    }
    setDialogState(prev => ({ ...prev, isOpen: false, resolve: undefined }))
  }, [dialogState.resolve])

  return (
    <DialogContext.Provider value={{ showDialog }}>
      {children}
      
      {/* 对话框遮罩层 */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancel}
          />
          
          {/* 对话框内容 */}
          <Card className="relative z-10 w-full max-w-md mx-4 shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  {dialogState.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            {dialogState.description && (
              <CardContent className="py-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {dialogState.description}
                </p>
              </CardContent>
            )}
            
            <CardFooter className="flex justify-end gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                {dialogState.cancelText}
              </Button>
              <Button
                variant={dialogState.variant === 'destructive' ? 'destructive' : 'default'}
                size="sm"
                onClick={handleConfirm}
              >
                {dialogState.confirmText}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </DialogContext.Provider>
  )
}

// Hook 用于使用对话框
export const useDialog = () => {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}
