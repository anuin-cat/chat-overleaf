import { useState, useEffect } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { ScrollArea } from "~components/ui/scroll-area"
import { Card } from "~components/ui/card"
import { 
  getEntities, 
  createFolder, 
  createDoc,
  downloadAndParseZip,
  checkApiAvailability,
  type OverleafEntity,
  type EntitiesResponse,
  type ZipFileInfo
} from "~contents/api"
import { CheckCircle2, XCircle, Folder, FileText, RefreshCw, Download, FileArchive } from "lucide-react"

interface LogEntry {
  id: string
  timestamp: Date
  type: 'success' | 'error' | 'info'
  message: string
  data?: any
}

interface ApiTestPanelProps {
  showApiTest: boolean
}

export function ApiTestPanel({ showApiTest }: ApiTestPanelProps) {
  const [apiStatus, setApiStatus] = useState<{
    available: boolean
    projectId: string | null
    csrfToken: string
  }>({ available: false, projectId: null, csrfToken: '' })

  const [entities, setEntities] = useState<EntitiesResponse | null>(null)
  const [zipFiles, setZipFiles] = useState<ZipFileInfo[] | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showZipView, setShowZipView] = useState(false)

  // 创建文件夹表单
  const [folderName, setFolderName] = useState('')
  const [folderParentId, setFolderParentId] = useState('')

  // 创建文档表单
  const [docName, setDocName] = useState('')
  const [docParentId, setDocParentId] = useState('')
  const [docContent, setDocContent] = useState('')

  // 添加日志
  const addLog = (type: 'success' | 'error' | 'info', message: string, data?: any) => {
    const log: LogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date(),
      type,
      message,
      data
    }
    setLogs(prev => [log, ...prev].slice(0, 50)) // 保留最近 50 条
  }

  // 检查 API 可用性
  useEffect(() => {
    if (showApiTest) {
      const status = checkApiAvailability()
      setApiStatus(status)
      addLog('info', `API 状态检查: ${status.available ? '可用' : '不可用'}`, status)
    }
  }, [showApiTest])

  // 获取实体树
  const handleGetEntities = async () => {
    setIsLoading(true)
    addLog('info', '正在获取项目实体树...')
    
    const result = await getEntities()
    setIsLoading(false)
    
    if (result.success && result.data) {
      setEntities(result.data)
      addLog('success', '成功获取实体树', result.data)
    } else {
      addLog('error', `获取失败: ${result.error}`)
    }
  }

  // 创建文件夹
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      addLog('error', '文件夹名称不能为空')
      return
    }

    setIsLoading(true)
    addLog('info', `正在创建文件夹: ${folderName}`)
    
    const result = await createFolder(folderName, folderParentId || undefined)
    setIsLoading(false)
    
    if (result.success && result.data) {
      addLog('success', `成功创建文件夹: ${result.data.name}`, result.data)
      setFolderName('')
      setFolderParentId('')
      // 自动刷新实体树
      handleGetEntities()
    } else {
      addLog('error', `创建失败: ${result.error}`)
    }
  }

  // 创建文档
  const handleCreateDoc = async () => {
    if (!docName.trim()) {
      addLog('error', '文档名称不能为空')
      return
    }

    setIsLoading(true)
    addLog('info', `正在创建文档: ${docName}`)
    
    const result = await createDoc(docName, docParentId || undefined, docContent || undefined)
    setIsLoading(false)
    
    if (result.success && result.data) {
      addLog('success', `成功创建文档: ${result.data.name}`, result.data)
      setDocName('')
      setDocParentId('')
      setDocContent('')
      // 自动刷新实体树
      handleGetEntities()
    } else {
      addLog('error', `创建失败: ${result.error}`)
    }
  }

  // 下载并解析 ZIP
  const handleDownloadZip = async () => {
    setIsLoading(true)
    addLog('info', '正在下载并解析项目 ZIP 文件...')
    
    const result = await downloadAndParseZip()
    setIsLoading(false)
    
    if (result.success && result.data) {
      setZipFiles(result.data)
      setShowZipView(true)
      const totalSize = result.data.reduce((sum, file) => sum + file.size, 0)
      addLog('success', `成功解析 ZIP，共 ${result.data.length} 个文件，总大小 ${formatBytes(totalSize)}`, {
        fileCount: result.data.length,
        totalSize
      })
    } else {
      addLog('error', `下载失败: ${result.error}`)
    }
  }

  // 格式化字节大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  // 渲染实体树（扁平路径格式）
  const renderEntity = (entity: OverleafEntity, index: number) => {
    // 获取文件/文件夹名称（路径的最后一部分）
    const pathParts = entity.path.split('/').filter(Boolean)
    const name = pathParts.pop() || entity.path
    // 计算缩进层级（路径深度）
    const level = pathParts.length
    const paddingLeft = level * 16
    
    // 根据类型选择图标和颜色
    const Icon = entity.type === 'folder' ? Folder : FileText
    const typeColor = entity.type === 'folder' ? 'text-amber-600' : 
                      entity.type === 'doc' ? 'text-blue-600' : 'text-gray-600'

    return (
      <div 
        key={`${entity.path}-${index}`}
        className="flex items-center gap-1 py-1 px-2 hover:bg-gray-50 rounded text-xs group"
        style={{ paddingLeft: `${paddingLeft}px` }}
        title={entity.path}
      >
        <Icon className={`h-3 w-3 ${typeColor}`} />
        <span className="font-mono text-gray-700 flex-1">{name}</span>
        <span className={`text-[10px] ${typeColor} opacity-70`}>{entity.type}</span>
      </div>
    )
  }

  // 渲染 ZIP 文件树
  const renderZipFile = (file: ZipFileInfo, index: number) => {
    // 获取文件名
    const pathParts = file.path.split('/').filter(Boolean)
    const name = pathParts.pop() || file.path
    // 计算缩进层级
    const level = pathParts.length
    const paddingLeft = level * 16
    
    // 根据类型选择图标和颜色
    const Icon = file.isFolder ? Folder : FileText
    const typeColor = file.isFolder ? 'text-amber-600' : 'text-blue-600'

    return (
      <div 
        key={`${file.path}-${index}`}
        className="flex items-center gap-1 py-1 px-2 hover:bg-gray-50 rounded text-xs group"
        style={{ paddingLeft: `${paddingLeft}px` }}
        title={file.path}
      >
        <Icon className={`h-3 w-3 ${typeColor}`} />
        <span className="font-mono text-gray-700 flex-1">{name}</span>
        {!file.isFolder && (
          <span className="text-[10px] text-gray-500">{formatBytes(file.size)}</span>
        )}
      </div>
    )
  }

  if (!showApiTest) return null

  return (
    <ScrollArea className="max-h-[50vh] bg-blue-50 border-b border-blue-200">
      <div className="p-3 space-y-3">
        <div className="text-xs font-semibold text-blue-800 mb-2">API 测试面板</div>

        {/* 状态栏 */}
        <Card className="p-2 bg-white">
        <div className="text-[10px] space-y-1">
          <div className="flex items-center gap-1">
            {apiStatus.available ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <XCircle className="h-3 w-3 text-red-500" />
            )}
            <span className="font-semibold">API 状态:</span>
            <span className={apiStatus.available ? 'text-green-600' : 'text-red-600'}>
              {apiStatus.available ? '可用' : '不可用'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold">Project ID:</span>
            <span className="font-mono text-gray-600">{apiStatus.projectId || '未检测到'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold">CSRF Token:</span>
            <span className="font-mono text-gray-600">
              {apiStatus.csrfToken ? `${apiStatus.csrfToken.substring(0, 20)}...` : '未检测到'}
            </span>
          </div>
        </div>
      </Card>

      {/* 文件树预览 */}
      <Card className="p-2 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">项目实体树</span>
            {entities && (
              <span className="text-[10px] text-gray-500">
                ({entities.entities?.length || 0} 项)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleGetEntities}
              disabled={isLoading || !apiStatus.available}
              className="h-6 px-2 text-[10px]"
              title="刷新实体树"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownloadZip}
              disabled={isLoading || !apiStatus.available}
              className="h-6 px-2 text-[10px]"
              title="下载并解析 ZIP"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[120px] border border-gray-200 rounded p-2 bg-gray-50">
          {entities ? (
            <div className="space-y-0.5">
              {entities.entities?.map((entity, index) => renderEntity(entity, index))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-4">
              点击刷新按钮获取实体树
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* ZIP 文件树视图 */}
      {showZipView && zipFiles && (
        <Card className="p-2 bg-white border-2 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileArchive className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700">ZIP 文件内容</span>
              <span className="text-[10px] text-gray-500">
                ({zipFiles.length} 项, {formatBytes(zipFiles.reduce((sum, f) => sum + f.size, 0))})
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowZipView(false)}
              className="h-6 px-2 text-[10px]"
            >
              关闭
            </Button>
          </div>
          <ScrollArea className="h-[120px] border border-green-200 rounded p-2 bg-green-50">
            <div className="space-y-0.5">
              {zipFiles.map((file, index) => renderZipFile(file, index))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* 操作表单 */}
      <div className="grid grid-cols-2 gap-2">
        {/* 创建文件夹 */}
        <Card className="p-2 bg-white">
          <div className="text-xs font-semibold text-gray-700 mb-2">创建文件夹</div>
          <div className="space-y-1.5">
            <Input
              placeholder="文件夹名称"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="父文件夹 ID (可选)"
              value={folderParentId}
              onChange={(e) => setFolderParentId(e.target.value)}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={isLoading || !apiStatus.available}
              className="w-full h-7 text-xs"
            >
              创建
            </Button>
          </div>
        </Card>

        {/* 创建文档 */}
        <Card className="p-2 bg-white">
          <div className="text-xs font-semibold text-gray-700 mb-2">创建文档</div>
          <div className="space-y-1.5">
            <Input
              placeholder="文档名称"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="父文件夹 ID (可选)"
              value={docParentId}
              onChange={(e) => setDocParentId(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="初始内容 (可选)"
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              onClick={handleCreateDoc}
              disabled={isLoading || !apiStatus.available}
              className="w-full h-7 text-xs"
            >
              创建
            </Button>
          </div>
        </Card>
      </div>

      {/* 日志控制台 */}
      <Card className="p-2 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">操作日志</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLogs([])}
            className="h-6 px-2 text-[10px]"
          >
            清空
          </Button>
        </div>
        <ScrollArea className="h-[100px] border border-gray-200 rounded p-2 bg-gray-50">
          {logs.length > 0 ? (
            <div className="space-y-1">
              {logs.map(log => (
                <div key={log.id} className="text-[10px] font-mono">
                  <span className="text-gray-400">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  <span className={`ml-1 font-semibold ${
                    log.type === 'success' ? 'text-green-600' :
                    log.type === 'error' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className="ml-1 text-gray-700">{log.message}</span>
                  {log.data && (
                    <div className="ml-4 mt-0.5 text-gray-500 break-all">
                      {JSON.stringify(log.data, null, 2).substring(0, 200)}
                      {JSON.stringify(log.data).length > 200 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-4">
              暂无日志
            </div>
          )}
        </ScrollArea>
      </Card>
      </div>
    </ScrollArea>
  )
}
