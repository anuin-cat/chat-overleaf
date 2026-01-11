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
  // 重置替换命令（用于切换历史记录）
  resetReplaceCommands: () => void
  // 替换命令状态管理
  replaceCommands: Map<string, ReplaceCommand>
  updateCommandStatus: (id: string, status: ReplaceCommand['status'], errorMessage?: string) => void
  // 获取文件内容
  getFileContent: (filePath: string) => string | undefined
  // 导航到文件
  navigateToFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  // 执行替换
  applyReplace: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string }>
  // 撤销已应用的替换
  undoApply: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string }>
  // 撤销已拒绝的替换
  undoReject: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string }>
  // 检查文件是否当前打开
  checkCurrentFile: (filePath: string) => Promise<{ isCurrentFile: boolean; currentFile: string }>
  // 智能预览：如果文件已打开则预览，否则导航到文件
  smartPreview: (command: ReplaceCommand) => Promise<{ success: boolean; error?: string; action: 'preview' | 'navigate' }>
  // 正在应用的命令 ID
  applyingCommandId: string | null
  // 批量高亮当前文件中的所有待替换区域
  highlightAllPending: (commands: ReplaceCommand[]) => Promise<{ success: boolean; count: number }>
  // 重新激活某个高亮
  reactivateHighlight: (command: ReplaceCommand) => Promise<boolean>
  // 移除单个高亮
  removeHighlight: (id: string) => Promise<void>
  // 移除所有悬浮高亮
  removeAllHoverHighlights: () => Promise<void>
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
        let hasNewCommand = false
        const newMap = new Map(prev)
        result.commands.forEach(cmd => {
          // 只添加新的命令，不覆盖已存在的
          if (!newMap.has(cmd.id)) {
            newMap.set(cmd.id, cmd)
            hasNewCommand = true
          }
        })
        return hasNewCommand ? newMap : prev
      })
    }
    
    return result
  }, [])

  const resetReplaceCommands = useCallback(() => {
    setReplaceCommands(new Map())
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
      // 若当前已打开目标文件，则无需等待；否则先导航并等待加载
      const fileStatus = await checkCurrentFile(command.file)
      if (!fileStatus.isCurrentFile) {
        const navResult = await navigateToFile(command.file)
        if (!navResult.success) {
          updateCommandStatus(command.id, 'error', navResult.error)
          return navResult
        }
        // 导航后给编辑器一点加载时间
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // 执行替换/插入操作
      const replaceResult = await sendMessageToMainWorld<{ 
        success: boolean
        error?: string
        replacedCount: number 
      }>(
        'REPLACE_IN_EDITOR',
        { 
          search: command.search, 
          replace: command.replace, 
          isRegex: command.isRegex,
          commandType: command.commandType || 'replace',
          insertAnchor: command.insertAnchor
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
  
  // 智能预览：导航到文件并显示悬浮高亮（统一 UI）
  const smartPreview = useCallback(async (command: ReplaceCommand): Promise<{
    success: boolean
    error?: string
    action: 'preview' | 'navigate'
  }> => {
    try {
      const fileCheck = await checkCurrentFile(command.file)

      if (!fileCheck.isCurrentFile) {
        const navResult = await navigateToFile(command.file)
        if (!navResult.success) {
          return { success: false, error: navResult.error, action: 'navigate' }
        }
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const result = await sendMessageToMainWorld<{ success: boolean; count: number }>(
        'ADD_HIGHLIGHT_REGIONS',
        { 
          commands: [{
            id: command.id,
            file: command.file,
            search: command.search,
            replace: command.replace,
            isRegex: command.isRegex,
            commandType: command.commandType,
            insertAnchor: command.insertAnchor
          }]
        }
      )

      if (!result.success) {
        return { success: false, error: '高亮失败', action: 'preview' }
      }

      if (result.count === 0) {
        return { success: false, error: '未找到匹配内容', action: 'preview' }
      }

      return { success: true, action: 'preview' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '操作失败',
        action: 'navigate'
      }
    }
  }, [checkCurrentFile, navigateToFile])

  // 批量高亮当前文件中的所有待替换区域
  const highlightAllPending = useCallback(async (commands: ReplaceCommand[]): Promise<{
    success: boolean
    count: number
  }> => {
    try {
      // 只处理 pending 状态的命令
      const pendingCommands = commands.filter(cmd => cmd.status === 'pending')
      if (pendingCommands.length === 0) {
        return { success: true, count: 0 }
      }
      
      const result = await sendMessageToMainWorld<{ success: boolean; count: number }>(
        'ADD_HIGHLIGHT_REGIONS',
        { 
          commands: pendingCommands.map(cmd => ({
            id: cmd.id,
            file: cmd.file,
            search: cmd.search,
            replace: cmd.replace,
            isRegex: cmd.isRegex,
            commandType: cmd.commandType,
            insertAnchor: cmd.insertAnchor
          }))
        }
      )
      
      return result
    } catch (error) {
      console.error('Error highlighting all pending:', error)
      return { success: false, count: 0 }
    }
  }, [])
  
  // 重新激活某个高亮（用于拒绝后重新显示）
  const reactivateHighlight = useCallback(async (command: ReplaceCommand): Promise<boolean> => {
    try {
      const result = await sendMessageToMainWorld<{ success: boolean }>(
        'REACTIVATE_HIGHLIGHT',
        { 
          id: command.id,
          file: command.file,
          search: command.search,
          replace: command.replace,
          isRegex: command.isRegex,
          commandType: command.commandType,
          insertAnchor: command.insertAnchor
        }
      )
      
      if (result.success) {
        // 重置状态为 pending
        updateCommandStatus(command.id, 'pending')
      }
      
      return result.success
    } catch (error) {
      console.error('Error reactivating highlight:', error)
      return false
    }
  }, [updateCommandStatus])

  // 撤销已应用：尝试将替换/插入内容还原，并恢复为 pending 再重新高亮
  const undoApply = useCallback(async (command: ReplaceCommand): Promise<{ success: boolean; error?: string }> => {
    try {
      const fileStatus = await checkCurrentFile(command.file)
      if (!fileStatus.isCurrentFile) {
        const navResult = await navigateToFile(command.file)
        if (!navResult.success) {
          return { success: false, error: navResult.error }
        }
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      let revertResult: { success: boolean; error?: string; replacedCount: number }
      
      if (command.commandType === 'insert') {
        // 插入操作的撤销：删除插入的内容（搜索插入内容并替换为空）
        revertResult = await sendMessageToMainWorld<{ success: boolean; error?: string; replacedCount: number }>(
          'REPLACE_IN_EDITOR',
          { 
            search: command.replace,  // 搜索插入的内容
            replace: '',              // 替换为空（删除）
            isRegex: false,
            commandType: 'replace'
          }
        )
      } else {
        // 替换操作的撤销：反向替换
        revertResult = await sendMessageToMainWorld<{ success: boolean; error?: string; replacedCount: number }>(
          'REPLACE_IN_EDITOR',
          { 
            search: command.replace, 
            replace: command.search, 
            isRegex: command.isRegex,
            commandType: 'replace'
          }
        )
      }

      if (!revertResult.success) {
        updateCommandStatus(command.id, 'error', revertResult.error)
        return { success: false, error: revertResult.error }
      }

      updateCommandStatus(command.id, 'pending')
      await reactivateHighlight(command)
      return { success: true }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '撤销失败'
      updateCommandStatus(command.id, 'error', errMsg)
      return { success: false, error: errMsg }
    }
  }, [checkCurrentFile, navigateToFile, reactivateHighlight, updateCommandStatus])

  // 撤销已拒绝：恢复 pending 并重新高亮
  const undoReject = useCallback(async (command: ReplaceCommand): Promise<{ success: boolean; error?: string }> => {
    try {
      updateCommandStatus(command.id, 'pending')
      await reactivateHighlight(command)
      return { success: true }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '撤销失败'
      updateCommandStatus(command.id, 'error', errMsg)
      return { success: false, error: errMsg }
    }
  }, [reactivateHighlight, updateCommandStatus])
  
  // 移除单个高亮
  const removeHighlight = useCallback(async (id: string): Promise<void> => {
    try {
      await sendMessageToMainWorld<{ success: boolean }>(
        'REMOVE_HIGHLIGHT',
        { id }
      )
    } catch (error) {
      console.error('Error removing highlight:', error)
    }
  }, [])
  
  // 移除所有悬浮高亮
  const removeAllHoverHighlights = useCallback(async (): Promise<void> => {
    try {
      await sendMessageToMainWorld<{ success: boolean; count: number }>(
        'REMOVE_ALL_HOVER_HIGHLIGHTS',
        {}
      )
    } catch (error) {
      console.error('Error removing hover highlights:', error)
    }
  }, [])
  
  // 监听悬浮高亮操作事件
  useEffect(() => {
    const handleDiffAction = (event: MessageEvent) => {
      if (event.data.type === 'HOVER_HIGHLIGHT_ACTION') {
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
    
    window.addEventListener('message', handleDiffAction)
    return () => window.removeEventListener('message', handleDiffAction)
  }, [updateCommandStatus])
  
  return {
    parseMessage,
    resetReplaceCommands,
    replaceCommands,
    updateCommandStatus,
    getFileContent,
    navigateToFile,
    applyReplace,
    undoApply,
    undoReject,
    checkCurrentFile,
    smartPreview,
    applyingCommandId,
    highlightAllPending,
    reactivateHighlight,
    removeHighlight,
    removeAllHoverHighlights
  }
}

export default useReplaceHandler
