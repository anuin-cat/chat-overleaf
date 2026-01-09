import type { ModelConfig } from './builtin-models'
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
   * 支持多种API格式和路径结构
   */
  private buildUrl(path: string): string {
    const baseUrl = this.modelConfig.base_url.replace(/\/+$/, '') // 移除末尾的斜杠
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    // 特殊情况处理：如果baseUrl已经包含完整的API路径，直接拼接
    // 例如：https://generativelanguage.googleapis.com/v1beta/openai + /chat/completions
    if (this.isCompleteApiPath(baseUrl)) {
      return `${baseUrl}${cleanPath.replace('/v1', '')}`
    }

    // 通用路径重复检查：避免版本号重复
    const versionPatterns = ['/v1', '/v1beta', '/v2', '/v3', '/api/v1', '/api/v2']

    for (const version of versionPatterns) {
      if (cleanPath.startsWith(`${version}/`) && baseUrl.endsWith(version)) {
        return `${baseUrl}${cleanPath.substring(version.length)}`
      }
    }

    // 默认情况：直接拼接
    return `${baseUrl}${cleanPath}`
  }

  /**
   * 检查baseUrl是否已经包含完整的API路径
   * 这些URL通常不需要额外的版本前缀
   */
  private isCompleteApiPath(baseUrl: string): boolean {
    const completeApiPatterns = [
      '/openai',           // Gemini OpenAI兼容: /v1beta/openai
      '/compatible-mode',  // 阿里云兼容模式: /compatible-mode/v1
      '/api/paas',         // 智谱AI: /api/paas/v4
    ]

    return completeApiPatterns.some(pattern => baseUrl.includes(pattern))
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

    const convertedMessages = messages.map(msg => this.convertToOpenAIMessage(msg))

    // 输出最终发送给API的消息内容用于调试
    console.log('=== 最终发送给API的消息 ===')
    console.log('Model:', this.modelConfig.model_name)
    console.log(convertedMessages)
    console.log('=== API消息结束 ===')

    const body = JSON.stringify({
      model: this.modelConfig.model_name,
      messages: convertedMessages,
      stream,
      temperature: 0.7,
      max_tokens: 16384   // 统一设置最大输出长度为16384
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

  /**
   * 获取模型列表
   */
  async fetchModels(): Promise<{ id: string; name: string }[]> {
    try {
      const headers = new Headers()
      headers.append('Authorization', `Bearer ${this.modelConfig.api_key}`)
      headers.append('Accept', 'application/json')

      const fullUrl = this.buildUrl('/v1/models')
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      
      // 处理不同API返回格式
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model: any) => ({
          id: model.id || model.model,
          name: model.id || model.model
        }))
      } else if (Array.isArray(data)) {
        return data.map((model: any) => ({
          id: model.id || model.model,
          name: model.id || model.model
        }))
      }
      
      return []
    } catch (error) {
      console.error('Error fetching models:', error)
      return []
    }
  }
}

/**
 * 静态方法：获取指定提供商的模型列表
 */
export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string
): Promise<{ id: string; name: string }[]> {
  try {
    const tempConfig: ModelConfig = {
      model_name: 'temp',
      display_name: 'temp',
      provider: 'temp',
      base_url: baseUrl,
      api_key: apiKey,
      multimodal: false
    }
    
    const client = new ApiClient(tempConfig)
    return await client.fetchModels()
  } catch (error) {
    console.error('Error in fetchProviderModels:', error)
    return []
  }
}
