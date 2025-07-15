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
      yield {
        content: '',
        finished: true,
        error: error instanceof Error ? error.message : 'Unknown error'
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
      throw error
    }
  }
}
