import type { ModelConfig } from './builtin-models'
import type { FileInfo } from '~components/chat/file/file-extraction-service'
import type { ChatMessage } from './llm-service'

/**
 * 文件内容处理服务
 * 处理文件内容为文本消息
 */
export class FileContentProcessor {
  /**
   * 处理文件内容为文本消息
   * @param files 文件列表
   * @param modelConfig 模型配置
   * @returns Promise<ChatMessage[]>
   */
  static async processFilesForModel(
    files: FileInfo[],
  ): Promise<ChatMessage[]> {
    if (files.length === 0) {
      return []
    }
    return this.createTextBasedMessages(files)
  }



  /**
   * 创建基于文本的消息
   * @param files 文件列表
   * @returns ChatMessage[]
   */
  private static createTextBasedMessages(files: FileInfo[]): ChatMessage[] {
    const messages: ChatMessage[] = []

    // 添加文件内容
    const selectedFileContents = files
      .map(file => `《文件：${file.name}》\n${file.content}`)
      .join('\n   ==========   \n')

    messages.push({
      role: 'system',
      content: `[系统自动提供的最新文件内容]\n${selectedFileContents}\n（此块为系统生成的最新文件内容，请以此为准，历史选中/划线内容可能已过期）`
    })

    return messages
  }

}
