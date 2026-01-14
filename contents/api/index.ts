/**
 * Overleaf API 统一导出
 */

// 导出类型
export type {
  EntityType,
  OverleafEntity,
  EntitiesResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  CreateDocRequest,
  CreateDocResponse,
  ApiError,
  ApiResult,
  ZipFileInfo
} from './types'

// 导出客户端函数
export {
  getProjectId,
  getCsrfToken,
  checkApiAvailability,
  apiRequest,
  apiGet,
  apiPost,
  apiDelete
} from './client'

// 导出项目 API
export {
  getEntities,
  createFolder,
  createDoc,
  deleteEntity,
  downloadAndParseZip
} from './project'
