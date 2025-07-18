// 文件相关的类型定义
export interface FileInfo {
  name: string
  content: string
  length: number
}

export interface ExtractionResult {
  success: boolean
  files: FileInfo[]
  mode: 'current' | 'all'
  error?: string
}

export type ExtractionMode = 'current' | 'all'

/**
 * 文件提取服务 - 处理与Overleaf的通信
 * 纯函数，易于测试，无副作用
 */
export class FileExtractionService {
  /**
   * 提取文件内容
   * @param mode 提取模式：'current' | 'all'
   * @returns Promise<ExtractionResult>
   */
  static async extractContent(mode: ExtractionMode): Promise<ExtractionResult> {
    try {
      // 发送消息到主世界脚本获取内容
      const requestId = Date.now().toString()

      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'OVERLEAF_CONTENT_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handleMessage)

            const { data } = event.data

            if (mode === 'all' && data.files) {
              // 处理所有文件模式
              if (data.success && data.files.length > 0) {
                resolve({
                  success: true,
                  files: data.files.map((file: any) => ({
                    name: file.name,
                    content: file.content,
                    length: file.length
                  })),
                  mode
                })
              } else {
                resolve({
                  success: false,
                  files: [],
                  mode,
                  error: data.error || '无法获取所有文件内容'
                })
              }
            } else {
              // 处理当前文件模式
              if (data.success && data.content) {
                resolve({
                  success: true,
                  files: [{
                    name: data.fileName || 'main.tex',
                    content: data.content,
                    length: data.length || data.content.length
                  }],
                  mode
                })
              } else {
                resolve({
                  success: false,
                  files: [],
                  mode,
                  error: data.error || '无法获取内容'
                })
              }
            }
          }
        }

        window.addEventListener('message', handleMessage)

        // 发送请求，包含模式参数
        window.postMessage({
          type: 'GET_OVERLEAF_CONTENT',
          requestId,
          mode
        }, '*')

        // 30秒超时
        setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          resolve({
            success: false,
            files: [],
            mode,
            error: '请求超时'
          })
        }, 30000)
      })
    } catch (error) {
      return {
        success: false,
        files: [],
        mode,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 复制文件内容到剪贴板
   * @param file 文件信息
   * @returns Promise<boolean> 是否成功
   */
  static async copyFileToClipboard(file: FileInfo): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(file.content)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }
}
