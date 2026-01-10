import type { FileInfo } from "./file-extraction-service"

/**
 * 树节点类型
 */
export interface TreeNode {
  name: string           // 节点名称（文件名或文件夹名）
  path: string           // 完整路径
  isFolder: boolean      // 是否为文件夹
  file?: FileInfo        // 如果是文件，对应的 FileInfo
  children: TreeNode[]   // 子节点
  charCount: number      // 字符数
  tokenCount: number     // 预估 token 数
}

/**
 * 判断字符是否为 CJK 字符
 */
const isCjk = (code: number) =>
  (code >= 0x4e00 && code <= 0x9fff) ||
  (code >= 0x3400 && code <= 0x4dbf) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0x3040 && code <= 0x30ff) ||
  (code >= 0xac00 && code <= 0xd7af)

/**
 * 估算文本的 token 权重
 */
export const estimateTokenWeight = (text: string): number => {
  let weight = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      weight += 0.25
      continue
    }
    if (isCjk(code)) {
      weight += 1
      continue
    }
    if (code <= 0x007f) {
      if (
        (code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a)
      ) {
        weight += 0.25
      } else {
        weight += 0.5
      }
      continue
    }
    weight += 0.8
  }
  return weight
}

/**
 * 估算文件的 token 数量
 */
export const estimateFileTokens = (file: FileInfo): number => {
  if (!file.content) return 0
  return Math.max(1, Math.ceil(estimateTokenWeight(file.content)))
}

/**
 * 将扁平的文件列表构建为树形结构
 */
export const buildFileTree = (files: FileInfo[]): TreeNode[] => {
  const root: TreeNode[] = []
  
  // 创建文件路径到 token 的映射
  const tokenMap = new Map<string, number>()
  for (const file of files) {
    tokenMap.set(file.name, estimateFileTokens(file))
  }
  
  for (const file of files) {
    const parts = file.name.split('/')
    let currentLevel = root
    let currentPath = ''
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLastPart = i === parts.length - 1
      
      let existingNode = currentLevel.find(node => node.name === part)
      
      if (!existingNode) {
        const newNode: TreeNode = {
          name: part,
          path: currentPath,
          isFolder: !isLastPart,
          file: isLastPart ? file : undefined,
          children: [],
          charCount: isLastPart ? file.length : 0,
          tokenCount: isLastPart ? (tokenMap.get(file.name) || 0) : 0
        }
        currentLevel.push(newNode)
        existingNode = newNode
      }
      
      if (!isLastPart) {
        currentLevel = existingNode.children
      }
    }
  }
  
  // 递归计算文件夹的 token 总数
  const calculateFolderStats = (nodes: TreeNode[]): void => {
    for (const node of nodes) {
      if (node.isFolder && node.children.length > 0) {
        calculateFolderStats(node.children)
        node.tokenCount = node.children.reduce((sum, child) => sum + child.tokenCount, 0)
        node.charCount = node.children.reduce((sum, child) => sum + child.charCount, 0)
      }
    }
  }
  
  calculateFolderStats(root)
  
  // 排序：文件夹在前，然后按名称排序
  const sortNodes = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if (node.isFolder) {
        sortNodes(node.children)
      }
    }
  }
  
  sortNodes(root)
  
  return root
}

/**
 * 获取文件夹下的所有文件路径（递归）
 */
export const getAllFilesInFolder = (node: TreeNode): string[] => {
  if (!node.isFolder) {
    return [node.path]
  }
  
  const files: string[] = []
  for (const child of node.children) {
    files.push(...getAllFilesInFolder(child))
  }
  return files
}

/**
 * 获取所有文件路径（用于从树中提取）
 */
export const getAllFilePaths = (nodes: TreeNode[]): string[] => {
  const paths: string[] = []
  const traverse = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      if (node.isFolder) {
        traverse(node.children)
      } else {
        paths.push(node.path)
      }
    }
  }
  traverse(nodes)
  return paths
}

/**
 * 检查文件夹下是否所有文件都被选中
 */
export const isFolderFullySelected = (node: TreeNode, selectedFiles: Set<string>): boolean => {
  if (!node.isFolder) {
    return selectedFiles.has(node.path)
  }
  
  const allFiles = getAllFilesInFolder(node)
  return allFiles.length > 0 && allFiles.every(file => selectedFiles.has(file))
}

/**
 * 检查文件夹下是否有部分文件被选中
 */
export const isFolderPartiallySelected = (node: TreeNode, selectedFiles: Set<string>): boolean => {
  if (!node.isFolder) return false
  
  const allFiles = getAllFilesInFolder(node)
  const selectedCount = allFiles.filter(file => selectedFiles.has(file)).length
  return selectedCount > 0 && selectedCount < allFiles.length
}

/**
 * 分析选中的文件，找出可以合并的文件夹
 * 返回一个结构，包含独立文件和可以合并的文件夹
 */
export interface MergedSelection {
  folders: {
    path: string
    name: string
    files: string[]
    tokenCount: number
  }[]
  files: string[]  // 不属于任何完整选中文件夹的独立文件
}

export const analyzeMergedSelection = (
  tree: TreeNode[],
  selectedFiles: Set<string>,
  allFiles: FileInfo[]
): MergedSelection => {
  const result: MergedSelection = {
    folders: [],
    files: []
  }
  
  // 创建文件到 token 的映射
  const tokenMap = new Map<string, number>()
  for (const file of allFiles) {
    tokenMap.set(file.name, estimateFileTokens(file))
  }
  
  // 已经被某个文件夹覆盖的文件
  const coveredFiles = new Set<string>()
  
  // 递归查找完整选中的文件夹（贪心选择最大的文件夹）
  const findMergedFolders = (nodes: TreeNode[], parentPath: string = '') => {
    for (const node of nodes) {
      if (node.isFolder && isFolderFullySelected(node, selectedFiles)) {
        // 这个文件夹完整选中
        const allFilesInFolder = getAllFilesInFolder(node)
        const totalTokens = allFilesInFolder.reduce((sum, f) => sum + (tokenMap.get(f) || 0), 0)
        
        result.folders.push({
          path: node.path,
          name: node.name,
          files: allFilesInFolder,
          tokenCount: totalTokens
        })
        
        // 标记这些文件已被覆盖
        for (const f of allFilesInFolder) {
          coveredFiles.add(f)
        }
      } else if (node.isFolder) {
        // 递归检查子节点
        findMergedFolders(node.children, node.path)
      }
    }
  }
  
  findMergedFolders(tree)
  
  // 找出未被覆盖的独立文件
  for (const fileName of selectedFiles) {
    if (!coveredFiles.has(fileName)) {
      result.files.push(fileName)
    }
  }
  
  // 按路径排序文件夹
  result.folders.sort((a, b) => a.path.localeCompare(b.path))
  result.files.sort((a, b) => a.localeCompare(b))
  
  return result
}

/**
 * 格式化数字显示（添加千分位）
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

