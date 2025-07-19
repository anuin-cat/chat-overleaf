import { useState, useEffect, useCallback } from "react"
import { storageUtils } from "~utils/storage"

// 聊天历史记录接口
export interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isStreaming?: boolean
  selectedText?: string
  isWaiting?: boolean
  waitingStartTime?: Date
}

// 用于存储的简化消息接口（只保存核心聊天信息）
export interface StoredMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

export interface ChatHistory {
  id: string
  name: string // 历史记录名称
  messages: StoredMessage[] // 消息列表（只保存核心信息）
  messageCount: number // 消息数量（气泡数量）
  lastUpdated: Date // 最后更新时间
  createdAt: Date // 创建时间
}

const CHAT_HISTORY_KEY = "chat_history"
const MAX_HISTORY_COUNT = 20  // 减少最大历史记录数量以节省存储空间

// 生成历史记录名称（使用用户第一条消息的前20个字符）
const generateHistoryName = (messages: Message[]): string => {
  const firstUserMessage = messages.find(msg => msg.isUser)
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim()
    return content.length > 20 ? content.substring(0, 20) + "..." : content
  }
  return "新对话"
}

// 检查消息列表是否只包含初始消息
const isOnlyInitialMessage = (messages: Message[]): boolean => {
  return messages.length === 1 && 
         !messages[0].isUser && 
         messages[0].content.includes("你好！我是你的 Overleaf 助手")
}

export const useChatHistory = () => {
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([])
  const [showHistoryList, setShowHistoryList] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 加载聊天历史
  const loadChatHistories = useCallback(async () => {
    setIsLoading(true)
    try {
      const histories = await storageUtils.get<ChatHistory[]>(CHAT_HISTORY_KEY, [])
      // 转换日期字符串为 Date 对象，确保安全处理
      const parsedHistories = histories.map(history => {
        // 安全地转换日期
        const lastUpdated = history.lastUpdated instanceof Date
          ? history.lastUpdated
          : new Date(history.lastUpdated)
        const createdAt = history.createdAt instanceof Date
          ? history.createdAt
          : new Date(history.createdAt)

        return {
          ...history,
          lastUpdated,
          createdAt,
          messages: history.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date
              ? msg.timestamp
              : new Date(msg.timestamp)
          }))
        }
      })
      // 按最后更新时间降序排列
      parsedHistories.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      setChatHistories(parsedHistories)
    } catch (error) {
      console.error("Failed to load chat histories:", error)
      setChatHistories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 保存聊天历史
  const saveChatHistory = useCallback(async (messages: Message[], customName?: string, historyId?: string) => {
    // 如果只有初始消息，不保存
    if (isOnlyInitialMessage(messages)) {
      return null
    }

    try {
      // 获取当前历史记录
      const currentHistories = await storageUtils.get<ChatHistory[]>(CHAT_HISTORY_KEY, [])

      // 清理消息数据，只保留聊天气泡信息，移除文件相关数据
      const cleanMessages: StoredMessage[] = messages.map(msg => ({
        id: msg.id,
        content: msg.content.length > 1000 ? msg.content.substring(0, 1000) + '...' : msg.content, // 限制消息长度
        isUser: msg.isUser,
        timestamp: msg.timestamp
        // 不保存 selectedText, isStreaming, isWaiting, waitingStartTime 等临时状态
      }))

      const finalHistoryId = historyId || `history_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const name = customName || generateHistoryName(cleanMessages)
      const messageCount = cleanMessages.length
      const now = new Date()

      const newHistory: ChatHistory = {
        id: finalHistoryId,
        name,
        messages: cleanMessages,
        messageCount,
        lastUpdated: now,
        createdAt: now
      }

      // 如果存在相同ID的历史记录，检查内容是否有变化
      const existingIndex = currentHistories.findIndex(history => history.id === finalHistoryId)
      let updatedHistories: ChatHistory[]

      if (existingIndex !== -1) {
        const existingHistory = currentHistories[existingIndex]

        // 比较消息内容是否有变化
        const existingSignature = existingHistory.messages.map(m => `${m.isUser}:${m.content}`).join('|')
        const newSignature = cleanMessages.map(m => `${m.isUser}:${m.content}`).join('|')

        updatedHistories = [...currentHistories]

        if (existingSignature === newSignature) {
          // 内容没有变化，保持原有的时间戳和位置
          console.log("History content unchanged, keeping original timestamp")
          // 不更新任何内容，保持原有记录不变
          return existingHistory
        } else {
          // 内容有变化，更新记录并更新时间戳
          console.log("History content changed, updating timestamp")
          updatedHistories[existingIndex] = {
            ...newHistory,
            createdAt: existingHistory.createdAt // 保持原创建时间
          }
        }
      } else {
        // 添加新记录到开头
        updatedHistories = [newHistory, ...currentHistories]
      }

      // 限制最多50条记录
      if (updatedHistories.length > MAX_HISTORY_COUNT) {
        updatedHistories.splice(MAX_HISTORY_COUNT)
      }

      await storageUtils.set(CHAT_HISTORY_KEY, updatedHistories)

      // 重新加载历史记录以确保状态同步
      await loadChatHistories()

      return newHistory
    } catch (error) {
      console.error("Failed to save chat history:", error)
      return null
    }
  }, [loadChatHistories])

  // 删除聊天历史
  const deleteChatHistory = useCallback(async (historyId: string) => {
    try {
      const currentHistories = await storageUtils.get<ChatHistory[]>(CHAT_HISTORY_KEY, [])
      const updatedHistories = currentHistories.filter(history => history.id !== historyId)

      await storageUtils.set(CHAT_HISTORY_KEY, updatedHistories)

      // 重新加载历史记录以确保状态同步
      await loadChatHistories()

      return true
    } catch (error) {
      console.error("Failed to delete chat history:", error)
      return false
    }
  }, [loadChatHistories])

  // 更新历史记录名称
  const updateHistoryName = useCallback(async (historyId: string, newName: string) => {
    try {
      const currentHistories = await storageUtils.get<ChatHistory[]>(CHAT_HISTORY_KEY, [])
      const updatedHistories = currentHistories.map(history =>
        history.id === historyId
          ? { ...history, name: newName, lastUpdated: new Date() }
          : history
      )

      await storageUtils.set(CHAT_HISTORY_KEY, updatedHistories)

      // 重新加载历史记录以确保状态同步
      await loadChatHistories()

      return true
    } catch (error) {
      console.error("Failed to update history name:", error)
      return false
    }
  }, [loadChatHistories])

  // 清空所有历史记录
  const clearAllHistories = useCallback(async () => {
    try {
      await storageUtils.remove(CHAT_HISTORY_KEY)
      setChatHistories([])
      return true
    } catch (error) {
      console.error("Failed to clear all histories:", error)
      return false
    }
  }, [])

  // 创建分支聊天
  const createBranchChat = useCallback(async (
    originalMessages: Message[],
    branchFromIndex: number,
    originalChatName: string
  ) => {
    try {
      // 获取分支点之前的所有消息（包括分支点消息）
      const branchMessages = originalMessages.slice(0, branchFromIndex + 1)

      // 生成新的分支ID
      const branchId = `branch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // 创建分支名称（在原名称前加分支表情）
      const branchName = `🌿 ${originalChatName}`

      // 注意：这里不立即保存分支为历史记录
      // 分支将作为当前活动的聊天，只有在用户进行其他操作时才会被保存

      return {
        branchId,
        branchName,
        branchMessages,
        branchHistory: null // 不立即创建历史记录
      }
    } catch (error) {
      console.error("Failed to create branch chat:", error)
      return null
    }
  }, [])

  // 切换历史列表显示状态
  const toggleHistoryList = useCallback(() => {
    setShowHistoryList(prev => !prev)
  }, [])

  // 组件挂载时加载历史记录
  useEffect(() => {
    loadChatHistories()
  }, [loadChatHistories])

  return {
    // 状态
    chatHistories,
    showHistoryList,
    isLoading,

    // 操作
    saveChatHistory,
    deleteChatHistory,
    updateHistoryName,
    clearAllHistories,
    loadChatHistories,
    toggleHistoryList,
    createBranchChat,

    // 工具函数
    generateHistoryName,
    isOnlyInitialMessage
  }
}
