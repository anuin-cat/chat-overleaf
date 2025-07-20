import type { ModelConfig } from './models'
import type { ChatMessage } from './llm-service'

/**
 * 统一的API客户端
 * 根据不同模型的API格式发送请求
 */
export class ApiClient {
  private modelConfig: ModelConfig

  constructor(modelConfig: ModelConfig) {
    this.modelConfig = modelConfig
  }

  /**
   * 智能构建API URL，避免路径重复
   */
  private buildUrl(path: string): string {
    const baseUrl = this.modelConfig.base_url.replace(/\/+$/, '') // 移除末尾的斜杠
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    // 检查base_url是否已经包含了路径的一部分
    if (cleanPath.startsWith('/v1/') && baseUrl.endsWith('/v1')) {
      return `${baseUrl}${cleanPath.substring(3)}` // 移除重复的/v1
    } else if (cleanPath.startsWith('/v1beta/') && baseUrl.endsWith('/v1beta')) {
      return `${baseUrl}${cleanPath.substring(7)}` // 移除重复的/v1beta
    } else {
      return `${baseUrl}${cleanPath}`
    }
  }

  /**
   * 发送聊天请求 - 统一使用OpenAI格式
   */
  async sendChatRequest(
    messages: ChatMessage[],
    stream: boolean = true,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    // 所有模型都使用OpenAI兼容格式
    return this.sendOpenAIRequest(messages, stream, abortSignal)
  }

  /**
   * 发送OpenAI格式请求（GPT、Claude、Gemini等）
   */
  private async sendOpenAIRequest(
    messages: ChatMessage[],
    stream: boolean,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    const headers = new Headers()
    headers.append('Accept', 'application/json')
    headers.append('Authorization', `Bearer ${this.modelConfig.api_key}`)
    headers.append('Content-Type', 'application/json')

    // 检查是否是Gemini模型
    const isGeminiModel = this.modelConfig.model_name.toLowerCase().includes('gemini')

    const body = JSON.stringify({
      model: this.modelConfig.model_name,
      messages: messages.map(msg => this.convertToOpenAIMessage(msg)),
      stream,
      temperature: 0.7, // Gemini使用0.9温度
      max_tokens: 8000   // Gemini使用400 max_tokens
    })

    const fullUrl = this.buildUrl('/v1/chat/completions')

    return fetch(fullUrl, {
      method: 'POST',
      headers,
      body,
      signal: abortSignal
    })
  }



  /**
   * 转换为OpenAI消息格式
   */
  private convertToOpenAIMessage(message: ChatMessage): any {
    if (typeof message.content === 'string') {
      return {
        role: message.role,
        content: message.content
      }
    }

    // 处理多模态消息
    const content: any[] = []
    
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && part.text) {
          content.push({
            type: 'text',
            text: part.text
          })
        } else if (part.type === 'image_url' && part.image_url?.url) {
          content.push({
            type: 'image_url',
            image_url: {
              url: part.image_url.url,
              detail: part.image_url.detail || 'high'
            }
          })
        }
      }
    }

    return {
      role: message.role,
      content: content.length > 0 ? content : message.content
    }
  }



  /**
   * 处理流式响应 - 统一使用OpenAI格式
   */
  async *processStreamResponse(response: Response): AsyncGenerator<{
    content: string
    finished: boolean
    error?: string
  }, void, unknown> {
    // 所有模型都使用OpenAI格式的流式响应处理
    yield* this.processOpenAIStream(response)
  }

  /**
   * 处理OpenAI格式的流式响应
   */
  private async *processOpenAIStream(response: Response): AsyncGenerator<{
    content: string
    finished: boolean
    error?: string
  }, void, unknown> {
    const reader = response.body?.getReader()
    if (!reader) {
      yield { content: '', finished: true, error: 'No response body' }
      return
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield { content: fullContent, finished: true }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                yield { content: fullContent, finished: false }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      yield {
        content: fullContent,
        finished: true,
        error: error instanceof Error ? error.message : 'Stream processing error'
      }
    }
  }


}
