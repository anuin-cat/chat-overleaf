/**
 * Overleaf 项目相关 API
 */

import JSZip from 'jszip'
import { apiGet, apiPost, getProjectId } from './client'
import type { 
  EntitiesResponse, 
  CreateFolderRequest, 
  CreateFolderResponse,
  CreateDocRequest,
  CreateDocResponse,
  ApiResult,
  ZipFileInfo
} from './types'

/**
 * 获取项目实体树（文件和文件夹结构）
 */
export async function getEntities(): Promise<ApiResult<EntitiesResponse>> {
  const projectId = getProjectId()
  if (!projectId) {
    return {
      success: false,
      error: '未找到项目 ID'
    }
  }

  return apiGet<EntitiesResponse>(`/project/${projectId}/entities`)
}

/**
 * 创建文件夹
 * @param name 文件夹名称
 * @param parentFolderId 父文件夹 ID（可选，不传则创建在根目录）
 */
export async function createFolder(
  name: string,
  parentFolderId?: string
): Promise<ApiResult<CreateFolderResponse>> {
  const projectId = getProjectId()
  if (!projectId) {
    return {
      success: false,
      error: '未找到项目 ID'
    }
  }

  const body: CreateFolderRequest = {
    name,
    ...(parentFolderId && { parent_folder_id: parentFolderId })
  }

  return apiPost<CreateFolderResponse>(`/project/${projectId}/folder`, body)
}

/**
 * 创建文档
 * @param name 文档名称
 * @param parentFolderId 父文件夹 ID（可选，不传则创建在根目录）
 * @param content 初始内容（可选）
 */
export async function createDoc(
  name: string,
  parentFolderId?: string,
  content?: string
): Promise<ApiResult<CreateDocResponse>> {
  const projectId = getProjectId()
  if (!projectId) {
    return {
      success: false,
      error: '未找到项目 ID'
    }
  }

  const body: CreateDocRequest = {
    name,
    ...(parentFolderId && { parent_folder_id: parentFolderId }),
    ...(content && { content })
  }

  return apiPost<CreateDocResponse>(`/project/${projectId}/doc`, body)
}

/**
 * 删除实体（文件或文件夹）
 * @param entityId 实体 ID
 * @param entityType 实体类型（doc 或 folder）
 */
export async function deleteEntity(
  entityId: string,
  entityType: 'doc' | 'folder'
): Promise<ApiResult<void>> {
  const projectId = getProjectId()
  if (!projectId) {
    return {
      success: false,
      error: '未找到项目 ID'
    }
  }

  const endpoint = entityType === 'doc' ? 'doc' : 'folder'
  return apiPost<void>(`/project/${projectId}/${endpoint}/${entityId}`, {})
}

/**
 * 下载并解析项目 ZIP 文件
 * @returns ZIP 文件中的所有文件信息
 */
export async function downloadAndParseZip(): Promise<ApiResult<ZipFileInfo[]>> {
  try {
    const projectId = getProjectId()
    if (!projectId) {
      return {
        success: false,
        error: '未找到项目 ID'
      }
    }

    // 下载 ZIP 文件
    const zipUrl = `/project/${projectId}/download/zip`
    const response = await fetch(zipUrl, { credentials: 'include' })
    
    if (!response.ok) {
      return {
        success: false,
        error: `下载失败: HTTP ${response.status}`
      }
    }

    const blob = await response.blob()
    
    // 使用 JSZip 解析
    const zip = await JSZip.loadAsync(blob)
    const files: ZipFileInfo[] = []

    // 遍历所有文件
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      // 跳过 __MACOSX 等系统文件
      if (relativePath.startsWith('__MACOSX/') || relativePath.startsWith('.')) {
        continue
      }

      const isFolder = zipEntry.dir
      const content = isFolder ? undefined : await zipEntry.async('uint8array')
      
      // 提取文件名
      const pathParts = relativePath.split('/').filter(Boolean)
      const name = pathParts[pathParts.length - 1] || relativePath

      files.push({
        name,
        path: relativePath,
        size: content ? content.length : 0,
        isFolder,
        content
      })
    }

    // 按路径排序
    files.sort((a, b) => a.path.localeCompare(b.path))

    return {
      success: true,
      data: files
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '解析 ZIP 失败'
    }
  }
}
