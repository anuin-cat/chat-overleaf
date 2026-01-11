/**
 * 处理文件替换操作的 Hook
 */
import { useState, useCallback, useEffect } from 'react'
import { parseReplaceCommands, type ReplaceCommand, type ParseResult } from '~lib/replace-service'

interface UseReplaceHandlerProps {
  extractedFiles: Array<{ name: string; content: string }>
}

interface UseReplaceHandlerReturn {
  // 解析消息中的替换命令
  parseMessage: (content: string) => ParseResult
  // 替换命令状态管理
  replaceCommands: Map<string, ReplaceCommand>
  updateCommandStatus: (id: string, status: ReplaceCommand['status'], errorMessage?: string) => void
  // 获取文件内容
  getFileContent: (filePath: string) => string | undefined
  // 导航到文件
  navigateToFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  // 执行替换
  applyReplace: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string }>
  // 高亮匹配内容
  highlightMatch: (command: ReplaceCommand) => Promise<void>
  // 在编辑器中显示内联差异预览
  showInlineDiff: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string; matchCount: number }>
  // 移除内联差异预览
  removeInlineDiff: (commandId: string) => Promise<void>
  // 移除所有内联差异预览
  removeAllInlineDiffs: () => Promise<void>
  // 检查文件是否当前打开
  checkCurrentFile: (filePath: string) => Promise<{ isCurrentFile: boolean; currentFile: string }>
  // 智能预览：如果文件已打开则预览，否则导航到文件
  smartPreview: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string; action: 'preview' | 'navigate' }>
  // 正在应用的命令 ID
  applyingCommandId: string | null
}

// 生成请求 ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 发送消息到 main world 并等待响应
function sendMessageToMainWorld<T>(
  type: string, 
  data: Record<string, unknown>,
  timeout = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId()
    const responseType = `${type}_RESPONSE`
    
    console.log(`[ChatOverleaf Hook] Sending message: ${type}`, { requestId, data })
    
    const timeoutId = setTimeout(() => {
      console.warn(`[ChatOverleaf Hook] Timeout waiting for: ${responseType}`)
      window.removeEventListener('message', handler)
      reject(new Error('请求超时'))
    }, timeout)
    
    const handler = (event: MessageEvent) => {
      // 忽略非对象消息
      if (!event.data || typeof event.data !== 'object') return
      
      if (event.data.type === responseType && event.data.requestId === requestId) {
        console.log(`[ChatOverleaf Hook] Received response: ${responseType}`, event.data.data)
        clearTimeout(timeoutId)
        window.removeEventListener('message', handler)
        resolve(event.data.data)
      }
    }
    
    window.addEventListener('message', handler)
    // 使用 window.top 确保消息发送到顶层 window
    const targetWindow = window.top || window
    targetWindow.postMessage({ type, requestId, ...data }, '*')
  })
}

export const useReplaceHandler = ({ 
  extractedFiles 
}: UseReplaceHandlerProps): UseReplaceHandlerReturn => {
  const [replaceCommands, setReplaceCommands] = useState<Map<string, ReplaceCommand>>(new Map())
  const [applyingCommandId, setApplyingCommandId] = useState<string | null>(null)
  
  // 解析消息中的替换命令
  const parseMessage = useCallback((content: string): ParseResult => {
    const result = parseReplaceCommands(content)
    
    // 更新命令状态映射
    if (result.commands.length > 0) {
      setReplaceCommands(prev => {
        const newMap = new Map(prev)
        result.commands.forEach(cmd => {
          // 只添加新的命令，不覆盖已存在的
          if (!newMap.has(cmd.id)) {
            newMap.set(cmd.id, cmd)
          }
        })
        return newMap
      })
    }
    
    return result
  }, [])
  
  // 更新命令状态
  const updateCommandStatus = useCallback((
    id: string, 
    status: ReplaceCommand['status'],
    errorMessage?: string
  ) => {
    setReplaceCommands(prev => {
      const newMap = new Map(prev)
      const cmd = newMap.get(id)
      if (cmd) {
        newMap.set(id, { ...cmd, status, errorMessage })
      }
      return newMap
    })
  }, [])
  
  // 获取文件内容
  const getFileContent = useCallback((filePath: string): string | undefined => {
    const file = extractedFiles.find(f => 
      f.name === filePath || 
      f.name.endsWith('/' + filePath) ||
      filePath.endsWith('/' + f.name)
    )
    return file?.content
  }, [extractedFiles])
  
  // 导航到文件
  const navigateToFile = useCallback(async (filePath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await sendMessageToMainWorld<{ success: boolean; error?: string }>(
        'NAVIGATE_TO_FILE',
        { filePath }
      )
      return result
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '导航失败' 
      }
    }
  }, [])
  
  // 执行替换
  const applyReplace = useCallback(async (command: ReplaceCommand): Promise<{ success: boolean; error?: string }> => {
    setApplyingCommandId(command.id)
    
    try {
      // 先导航到文件
      const navResult = await navigateToFile(command.file)
      if (!navResult.success) {
        updateCommandStatus(command.id, 'error', navResult.error)
        return navResult
      }
      
      // 等待文件加载
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 执行替换
      const replaceResult = await sendMessageToMainWorld<{ 
        success: boolean
        error?: string
        replacedCount: number 
      }>(
        'REPLACE_IN_EDITOR',
        { 
          search: command.search, 
          replace: command.replace, 
          isRegex: command.isRegex 
        }
      )
      
      if (replaceResult.success) {
        updateCommandStatus(command.id, 'applied')
        return { success: true }
      } else {
        updateCommandStatus(command.id, 'error', replaceResult.error)
        return { success: false, error: replaceResult.error }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '替换失败'
      updateCommandStatus(command.id, 'error', errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setApplyingCommandId(null)
    }
  }, [navigateToFile, updateCommandStatus])
  
  // 高亮匹配内容
  const highlightMatch = useCallback(async (command: ReplaceCommand): Promise<void> => {
    try {
      // 先导航到文件
      await navigateToFile(command.file)
      
      // 等待文件加载
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 高亮匹配
      await sendMessageToMainWorld<{ success: boolean; positions: Array<{ from: number; to: number }> }>(
        'HIGHLIGHT_IN_EDITOR',
        { search: command.search, isRegex: command.isRegex }
      )
    } catch (error) {
      console.error('Error highlighting match:', error)
    }
  }, [navigateToFile])
  
  // 在编辑器中显示内联差异预览
  const showInlineDiff = useCallback(async (command: ReplaceCommand): Promise<{ 
    success: boolean
    error?: string
    matchCount: number 
  }> => {
    try {
      console.log('[ChatOverleaf Hook] showInlineDiff called:', command.id, command.file)
      
      // 先导航到文件
      const navResult = await navigateToFile(command.file)
      console.log('[ChatOverleaf Hook] Navigation result:', navResult)
      
      if (!navResult.success) {
        return { success: false, error: navResult.error, matchCount: 0 }
      }
      
      // 等待文件加载
      await new Promise(resolve => setTimeout(resolve, 600))
      
      console.log('[ChatOverleaf Hook] Sending SHOW_INLINE_DIFF message')
      
      // 显示内联差异
      const result = await sendMessageToMainWorld<{
        success: boolean
        error?: string
        matchCount: number
      }>(
        'SHOW_INLINE_DIFF',
        { 
          id: command.id,
          search: command.search, 
          replace: command.replace,
          isRegex: command.isRegex 
        }
      )
      
      console.log('[ChatOverleaf Hook] SHOW_INLINE_DIFF result:', result)
      return result
    } catch (error) {
      console.error('[ChatOverleaf Hook] Error showing inline diff:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '显示差异失败',
        matchCount: 0
      }
    }
  }, [navigateToFile])
  
  // 移除内联差异预览
  const removeInlineDiff = useCallback(async (commandId: string): Promise<void> => {
    try {
      await sendMessageToMainWorld<{ success: boolean }>(
        'REMOVE_INLINE_DIFF',
        { id: commandId }
      )
    } catch (error) {
      console.error('Error removing inline diff:', error)
    }
  }, [])
  
  // 移除所有内联差异预览
  const removeAllInlineDiffs = useCallback(async (): Promise<void> => {
    try {
      await sendMessageToMainWorld<{ success: boolean; count: number }>(
        'REMOVE_ALL_INLINE_DIFFS',
        {}
      )
    } catch (error) {
      console.error('Error removing all inline diffs:', error)
    }
  }, [])
  
  // 检查文件是否当前打开
  const checkCurrentFile = useCallback(async (filePath: string): Promise<{ 
    isCurrentFile: boolean
    currentFile: string 
  }> => {
    try {
      const result = await sendMessageToMainWorld<{ isCurrentFile: boolean; currentFile: string }>(
        'CHECK_CURRENT_FILE',
        { filePath }
      )
      return result
    } catch (error) {
      console.error('Error checking current file:', error)
      return { isCurrentFile: false, currentFile: '' }
    }
  }, [])
  
  // 智能预览：如果文件已打开则预览，否则导航到文件
  const smartPreview = useCallback(async (command: ReplaceCommand): Promise<{
    success: boolean
    error?: string
    action: 'preview' | 'navigate'
  }> => {
    try {
      // 检查文件是否已打开
      const { isCurrentFile } = await checkCurrentFile(command.file)
      
      if (isCurrentFile) {
        // 文件已打开，直接显示预览
        const result = await showInlineDiff(command)
        return { 
          success: result.success, 
          error: result.error, 
          action: 'preview' 
        }
      } else {
        // 文件未打开，先导航到文件
        const navResult = await navigateToFile(command.file)
        return { 
          success: navResult.success, 
          error: navResult.error, 
          action: 'navigate' 
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '操作失败',
        action: 'navigate'
      }
    }
  }, [checkCurrentFile, showInlineDiff, navigateToFile])
  
  // 监听内联差异操作事件
  useEffect(() => {
    const handleInlineDiffAction = (event: MessageEvent) => {
      if (event.data.type === 'INLINE_DIFF_ACTION') {
        const { id, action, success, error } = event.data.data
        
        if (action === 'accepted') {
          if (success) {
            updateCommandStatus(id, 'applied')
          } else {
            updateCommandStatus(id, 'error', error)
          }
        } else if (action === 'rejected') {
          updateCommandStatus(id, 'rejected')
        }
      }
    }
    
    window.addEventListener('message', handleInlineDiffAction)
    return () => window.removeEventListener('message', handleInlineDiffAction)
  }, [updateCommandStatus])
  
  return {
    parseMessage,
    replaceCommands,
    updateCommandStatus,
    getFileContent,
    navigateToFile,
    applyReplace,
    highlightMatch,
    showInlineDiff,
    removeInlineDiff,
    removeAllInlineDiffs,
    checkCurrentFile,
    smartPreview,
    applyingCommandId
  }
}

export default useReplaceHandler

