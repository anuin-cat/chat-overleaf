import type { ModelConfig } from './models'
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
    modelConfig: ModelConfig
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
      .map(file => `文件 ${file.name}:\n${file.content}`)
      .join('\n\n')

    messages.push({
      role: 'system',
      content: `以下是用户提供的文件内容作为上下文：\n\n${selectedFileContents}`
    })

    return messages
  }

}
