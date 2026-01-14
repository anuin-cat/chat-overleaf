/**
 * Overleaf API 基础客户端
 * 封装基础 HTTP 请求逻辑
 */

import type { ApiResult } from './types'

/**
 * 从 URL 中提取项目 ID
 */
export function getProjectId(): string | null {
  const parts = location.pathname.split('/')
  const idx = parts.indexOf('project')
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * 获取 CSRF Token
 */
export function getCsrfToken(): string {
  const meta = document.querySelector('meta[name="ol-csrfToken"]')
  return meta?.getAttribute('content') || ''
}

/**
 * 检查项目 ID 和 CSRF Token 是否可用
 */
export function checkApiAvailability(): { available: boolean; projectId: string | null; csrfToken: string } {
  const projectId = getProjectId()
  const csrfToken = getCsrfToken()
  return {
    available: !!projectId && !!csrfToken,
    projectId,
    csrfToken
  }
}

/**
 * 基础 Fetch 请求封装
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const csrfToken = getCsrfToken()
    
    const headers = new Headers(options.headers || {})
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // 自动携带 Cookie
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText || response.statusText}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * GET 请求
 */
export async function apiGet<T = any>(url: string): Promise<ApiResult<T>> {
  return apiRequest<T>(url, {
    method: 'GET'
  })
}

/**
 * POST 请求
 */
export async function apiPost<T = any>(url: string, body?: any): Promise<ApiResult<T>> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined
  })
}

/**
 * DELETE 请求
 */
export async function apiDelete<T = any>(url: string): Promise<ApiResult<T>> {
  return apiRequest<T>(url, {
    method: 'DELETE'
  })
}
