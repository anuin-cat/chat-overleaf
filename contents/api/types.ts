/**
 * Overleaf API 类型定义
 */

/**
 * 实体类型：文件夹或文档
 */
export type EntityType = 'folder' | 'doc' | 'file' | 'fileRef'

/**
 * Overleaf 实体（扁平路径格式）
 */
export interface OverleafEntity {
  path: string
  type: EntityType
  _id?: string
  name?: string
}

/**
 * 项目实体树响应
 */
export interface EntitiesResponse {
  project_id: string
  entities: OverleafEntity[]
}

/**
 * 创建文件夹请求
 */
export interface CreateFolderRequest {
  name: string
  parent_folder_id?: string
}

/**
 * 创建文件夹响应
 */
export interface CreateFolderResponse {
  _id: string
  name: string
}

/**
 * 创建文档请求
 */
export interface CreateDocRequest {
  name: string
  parent_folder_id?: string
  content?: string
}

/**
 * 创建文档响应
 */
export interface CreateDocResponse {
  _id: string
  name: string
}

/**
 * API 错误响应
 */
export interface ApiError {
  message: string
  statusCode?: number
  details?: any
}

/**
 * API 操作结果
 */
export interface ApiResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * ZIP 文件中的文件信息
 */
export interface ZipFileInfo {
  name: string
  path: string
  size: number
  isFolder: boolean
  content?: Uint8Array
}
