import { useState, useEffect, useCallback } from "react"

export interface SelectedTextInfo {
  text: string
  fileName: string
  folderPath?: string
  hasSelection: boolean
}

export const useSelectedText = () => {
  const [selectedText, setSelectedText] = useState<SelectedTextInfo>({
    text: '',
    fileName: '',
    folderPath: '',
    hasSelection: false
  })

  // 监听来自 content script 的选择变化消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'OVERLEAF_SELECTION_CHANGED') {
        const { text, fileName, folderPath, hasSelection } = event.data.data
        setSelectedText({
          text,
          fileName,
          folderPath,
          hasSelection
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // 手动获取选中文本
  const getSelectedText = useCallback(async (): Promise<SelectedTextInfo> => {
    return new Promise((resolve) => {
      const requestId = Date.now().toString()
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data.type === 'SELECTED_TEXT_RESPONSE' && 
            event.data.requestId === requestId) {
          window.removeEventListener('message', handleResponse)
          
          const data = event.data.data
          if (data.success) {
            const result = {
              text: data.text || '',
              fileName: data.fileName || '',
              folderPath: data.folderPath || '',
              hasSelection: (data.text || '').length > 0
            }
            setSelectedText(result)
            resolve(result)
          } else {
            resolve({
              text: '',
              fileName: '',
              hasSelection: false
            })
          }
        }
      }

      window.addEventListener('message', handleResponse)
      
      // 发送获取选中文本的请求
      window.postMessage({
        type: 'GET_SELECTED_TEXT',
        requestId
      }, '*')

      // 超时处理
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({
          text: '',
          fileName: '',
          hasSelection: false
        })
      }, 1000)
    })
  }, [])

  // 清除选中文本
  const clearSelectedText = useCallback(() => {
    setSelectedText({
      text: '',
      fileName: '',
      hasSelection: false
    })
  }, [])

  return {
    selectedText,
    getSelectedText,
    clearSelectedText,
    hasSelection: selectedText.hasSelection
  }
}
