/**
 * 处理文件替换操作的 Hook
 */
import { useState, useCallback, useEffect } from 'react'
import { parseReplaceCommands, type ReplaceCommand, type ParseResult } from '~lib/replace-service'
import { createDoc, createFolder } from '~contents/api'

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
  highlightAllPending: (commands: ReplaceCommand[], options?: { shouldScroll?: boolean }) => Promise<{ success: boolean; count: number }>
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
  timeout = 10000,
  responseTypeOverride?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId()
    const responseType = responseTypeOverride || `${type}_RESPONSE`
    
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

function normalizePath(input: string): string {
  return input.replace(/^\/+/, '').replace(/\/+$/, '').trim()
}

function isAlreadyExistsError(message?: string): boolean {
  if (!message) return false
  return /already exists|已存在|exists/i.test(message)
}

function areCommandsEquivalent(a: ReplaceCommand, b: ReplaceCommand): boolean {
  if (a.file !== b.file) return false
  if (a.search !== b.search) return false
  if (a.replace !== b.replace) return false
  if (a.isRegex !== b.isRegex) return false
  if (a.commandType !== b.commandType) return false
  const aAfter = a.insertAnchor?.after ?? ''
  const bAfter = b.insertAnchor?.after ?? ''
  if (aAfter !== bAfter) return false
  const aBefore = a.insertAnchor?.before ?? ''
  const bBefore = b.insertAnchor?.before ?? ''
  if (aBefore !== bBefore) return false
  return true
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
          const existing = newMap.get(cmd.id)
          if (!existing) {
            newMap.set(cmd.id, cmd)
            hasNewCommand = true
            return
          }
          const shouldReplace = !areCommandsEquivalent(existing, cmd)
          if (shouldReplace) {
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

  const getFolderIdByPath = useCallback(async (folderPath: string): Promise<string | null> => {
    try {
      const result = await sendMessageToMainWorld<{ success: boolean; folderId?: string }>(
        'GET_FOLDER_ID_BY_PATH',
        { folderPath }
      )
      return result.folderId || null
    } catch (error) {
      console.warn('Error getting folder id by path:', error)
      return null
    }
  }, [])

  const getFileIdByPath = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const result = await sendMessageToMainWorld<{ success: boolean; fileId?: string }>(
        'GET_FILE_ID_BY_PATH',
        { filePath }
      )
      return result.fileId || null
    } catch (error) {
      console.warn('Error getting file id by path:', error)
      return null
    }
  }, [])

  const createFileWithFolders = useCallback(async (command: ReplaceCommand): Promise<{ success: boolean; error?: string }> => {
    const targetPath = normalizePath(command.file)
    if (!targetPath) {
      updateCommandStatus(command.id, 'error', '文件路径不能为空')
      return { success: false, error: '文件路径不能为空' }
    }

    const parts = targetPath.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) {
      updateCommandStatus(command.id, 'error', '文件路径无效')
      return { success: false, error: '文件路径无效' }
    }

    const existingFileId = await getFileIdByPath(targetPath)
    if (existingFileId) {
      const navResult = await navigateToFile(command.file)
      if (!navResult.success) {
        const errorMessage = navResult.error || '文件已存在，但无法打开进行检查'
        updateCommandStatus(command.id, 'error', errorMessage)
        return { success: false, error: errorMessage }
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      const contentResult = await sendMessageToMainWorld<{
        success: boolean
        content?: string
        fileName?: string
        error?: string
      }>('GET_OVERLEAF_CONTENT', { mode: 'current' }, 10000, 'OVERLEAF_CONTENT_RESPONSE')

      if (!contentResult.success) {
        const errorMessage = contentResult.error || '读取文件内容失败'
        updateCommandStatus(command.id, 'error', errorMessage)
        return { success: false, error: errorMessage }
      }

      const normalizedCurrent = normalizePath(contentResult.fileName || '')
      if (normalizedCurrent && normalizedCurrent !== targetPath) {
        const errorMessage = '文件已存在，但当前打开文件不匹配，无法安全写入'
        updateCommandStatus(command.id, 'error', errorMessage)
        return { success: false, error: errorMessage }
      }

      const currentContent = contentResult.content || ''
      if (currentContent.trim().length > 0) {
        const errorMessage = '插入失败：文件已存在且已有内容，文件树未更新的情况下插入有风险，请更新后重新操作'
        updateCommandStatus(command.id, 'error', errorMessage)
        return { success: false, error: errorMessage }
      }

      const appendResult = await sendMessageToMainWorld<{ success: boolean; error?: string }>(
        'APPEND_EDITOR_CONTENT',
        { content: command.replace }
      )
      if (!appendResult.success) {
        const errorMessage = appendResult.error || '写入文件内容失败'
        updateCommandStatus(command.id, 'error', errorMessage)
        return { success: false, error: errorMessage }
      }

      updateCommandStatus(command.id, 'applied')
      return { success: true }
    }

    let currentParentId: string | undefined = undefined
    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const existingFolderId = await getFolderIdByPath(currentPath)
      if (existingFolderId) {
        currentParentId = existingFolderId
        continue
      }

      const createResult = await createFolder(part, currentParentId)
      if (!createResult.success || !createResult.data) {
        if (isAlreadyExistsError(createResult.error)) {
          const refreshedId = await getFolderIdByPath(currentPath)
          if (refreshedId) {
            currentParentId = refreshedId
            continue
          }
        }
        const errorMessage = createResult.error || '创建文件夹失败'
        updateCommandStatus(command.id, 'error', errorMessage)
        return { success: false, error: errorMessage }
      }
      currentParentId = createResult.data._id
    }

    const docResult = await createDoc(fileName, currentParentId, command.replace)
    if (!docResult.success) {
      const errorMessage = isAlreadyExistsError(docResult.error)
        ? '文件已存在，请先在编辑器打开该文件以更新文件树'
        : (docResult.error || '创建文件失败')
      updateCommandStatus(command.id, 'error', errorMessage)
      return { success: false, error: errorMessage }
    }

    let opened = false
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const navResult = await navigateToFile(command.file)
      if (navResult.success) {
        opened = true
        break
      }
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    if (!opened) {
      const errorMessage = '文件已创建，但未能自动打开，请手动打开后再执行写入'
      updateCommandStatus(command.id, 'error', errorMessage)
      return { success: false, error: errorMessage }
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    const setResult = await sendMessageToMainWorld<{ success: boolean; error?: string }>(
      'APPEND_EDITOR_CONTENT',
      { content: command.replace }
    )
    if (!setResult.success) {
      const errorMessage = setResult.error || '写入文件内容失败'
      updateCommandStatus(command.id, 'error', errorMessage)
      return { success: false, error: errorMessage }
    }

    updateCommandStatus(command.id, 'applied')
    return { success: true }
  }, [getFileIdByPath, getFolderIdByPath, navigateToFile, updateCommandStatus])

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
  
  // 执行替换
  const applyReplace = useCallback(async (command: ReplaceCommand): Promise<{ success: boolean; error?: string }> => {
    setApplyingCommandId(command.id)
    
    try {
      if (command.commandType === 'create') {
        return await createFileWithFolders(command)
      }
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

      // 判断匹配位置是否在视口内，不在则滚动并延迟 666ms 再执行替换
      let shouldDelay = false
      try {
        const visibility = await sendMessageToMainWorld<{ visible: boolean; hasMatch: boolean; pos?: number }>(
          'CHECK_MATCH_VISIBLE',
          { 
            search: command.search, 
            replace: command.replace, 
            isRegex: command.isRegex,
            commandType: command.commandType,
            insertAnchor: command.insertAnchor
          }
        )
        if (!visibility.visible && visibility.hasMatch && typeof visibility.pos === 'number') {
          shouldDelay = true
          await sendMessageToMainWorld<{ success: boolean }>(
            'SCROLL_TO_POSITION',
            { pos: visibility.pos }
          )
        }
      } catch (error) {
        console.warn('[ChatOverleaf] CHECK_MATCH_VISIBLE failed, fallback to immediate replace', error)
      }
      
      if (shouldDelay) {
        await new Promise(resolve => setTimeout(resolve, 666))
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
  }, [checkCurrentFile, createFileWithFolders, navigateToFile, updateCommandStatus])
  
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
        // 导航后等待编辑器加载完成
        await new Promise(resolve => setTimeout(resolve, 600))
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
          }],
          shouldScroll: true
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
  const highlightAllPending = useCallback(async (commands: ReplaceCommand[], options?: { shouldScroll?: boolean }): Promise<{
    success: boolean
    count: number
  }> => {
    const shouldScroll = options?.shouldScroll ?? false
    try {
      // 只处理 pending 状态的命令
      const pendingCommands = commands.filter(cmd => cmd.status === 'pending' && cmd.commandType !== 'create')
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
          })),
          shouldScroll
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
      if (command.commandType !== 'create') {
        await reactivateHighlight(command)
      }
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
