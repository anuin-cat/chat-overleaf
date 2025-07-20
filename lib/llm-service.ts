import OpenAI from 'openai'
import type { ModelConfig } from './models'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamResponse {
  content: string
  finished: boolean
  error?: string
}

export class LLMService {
  private client: OpenAI
  private model: ModelConfig

  constructor(model: ModelConfig) {
    this.model = model
    this.client = new OpenAI({
      apiKey: model.api_key,
      baseURL: model.base_url,
      dangerouslyAllowBrowser: true // 允许在浏览器中使用
    })
  }

  // 更新模型配置
  updateModel(model: ModelConfig) {
    this.model = model
    this.client = new OpenAI({
      apiKey: model.api_key,
      baseURL: model.base_url,
      dangerouslyAllowBrowser: true
    })
  }

  // 流式聊天
  async *streamChat(
    messages: ChatMessage[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<StreamResponse, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model.model_name,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true,
        temperature: 0.7,
        max_tokens: 4000
      }, {
        signal: abortSignal
      })

      let fullContent = ''

      for await (const chunk of stream) {
        if (abortSignal?.aborted) {
          yield {
            content: fullContent,
            finished: true,
            error: 'Request aborted'
          }
          return
        }

        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          fullContent += delta.content
          yield {
            content: fullContent,
            finished: false
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          yield {
            content: fullContent,
            finished: true
          }
          return
        }
      }
    } catch (error) {
      console.error('LLM Service Error:', error)

      // 提供更详细的错误信息
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message

        // 检查是否是网络错误
        if (error.message.includes('fetch')) {
          errorMessage += '\n\n这可能是网络连接问题或API服务不可用。'
        }

        // 检查是否是认证错误
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage += '\n\n请检查API Key是否正确配置。'
        }

        // 检查是否是余额不足
        if (error.message.includes('insufficient') || error.message.includes('quota') || error.message.includes('billing')) {
          errorMessage += '\n\n可能是账户余额不足，请检查账户余额。'
        }

        // 检查是否是频率限制
        if (error.message.includes('rate') || error.message.includes('429')) {
          errorMessage += '\n\n请求频率过高，请稍后重试。'
        }
      }

      yield {
        content: '',
        finished: true,
        error: errorMessage
      }
    }
  }

  // 非流式聊天（备用）
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model.model_name,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: 4000
      })

      return response.choices[0]?.message?.content || 'No response'
    } catch (error) {
      console.error('LLM Service Error:', error)

      // 提供更详细的错误信息
      if (error instanceof Error) {
        let errorMessage = error.message

        // 检查是否是网络错误
        if (error.message.includes('fetch')) {
          errorMessage += '\n\n这可能是网络连接问题或API服务不可用。'
        }

        // 检查是否是认证错误
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage += '\n\n请检查API Key是否正确配置。'
        }

        // 检查是否是余额不足
        if (error.message.includes('insufficient') || error.message.includes('quota') || error.message.includes('billing')) {
          errorMessage += '\n\n可能是账户余额不足，请检查账户余额。'
        }

        // 检查是否是频率限制
        if (error.message.includes('rate') || error.message.includes('429')) {
          errorMessage += '\n\n请求频率过高，请稍后重试。'
        }

        // 创建新的错误对象，包含详细信息
        const detailedError = new Error(errorMessage)
        detailedError.stack = error.stack
        throw detailedError
      }

      throw error
    }
  }
}
