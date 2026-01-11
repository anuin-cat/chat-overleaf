import type { ModelConfig } from './builtin-models'
import { ApiClient } from './api-client'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
      detail?: 'low' | 'high' | 'auto'
    }
  }>
}

export interface StreamResponse {
  content: string
  finished: boolean
  error?: string
  // 思考过程相关
  thinking?: string
  thinkingFinished?: boolean
}

export class LLMService {
  private apiClient: ApiClient
  private model: ModelConfig
  private generationParams: { temperature: number; maxTokens: number }

  constructor(model: ModelConfig) {
    this.model = model
    this.apiClient = new ApiClient(model)
    this.generationParams = {
      temperature: 0.36,
      maxTokens: 16384
    }
  }

  // 更新模型配置
  updateModel(model: ModelConfig) {
    this.model = model
    this.apiClient = new ApiClient(model)
  }

  // 更新生成参数（温度、最大 tokens）
  updateGenerationParams(params: { temperature?: number; maxTokens?: number }) {
    if (params.temperature !== undefined) {
      this.generationParams.temperature = params.temperature
    }
    if (params.maxTokens !== undefined) {
      this.generationParams.maxTokens = params.maxTokens
    }
  }

  // 流式聊天
  async *streamChat(
    messages: ChatMessage[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<StreamResponse, void, unknown> {
    try {
      // 发送请求
      const response = await this.apiClient.sendChatRequest(
        messages,
        true,
        abortSignal,
        {
          temperature: this.generationParams.temperature,
          maxTokens: this.generationParams.maxTokens
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      // 处理流式响应
      for await (const chunk of this.apiClient.processStreamResponse(response)) {
        if (abortSignal?.aborted) {
          yield {
            content: chunk.content,
            finished: true,
            error: 'Request aborted'
          }
          return
        }

        yield chunk

        if (chunk.finished) {
          return
        }
      }
    } catch (error) {
      yield {
        content: '',
        finished: true,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // 非流式聊天（备用）
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      // 发送请求
      const response = await this.apiClient.sendChatRequest(
        messages,
        false,
        undefined,
        {
          temperature: this.generationParams.temperature,
          maxTokens: this.generationParams.maxTokens
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // 根据API格式解析响应
      const apiFormat = this.model.api_format || 'openai'

      if (apiFormat === 'gemini') {
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
      } else {
        return data.choices?.[0]?.message?.content || 'No response'
      }
    } catch (error) {
      throw error
    }
  }
}
