/**
 * Overleaf 文件树操作模块
 * 用于获取和解析 Overleaf 左侧文件树内容
 */

export interface FileTreeItem {
  name: string
  path: string
  element: Element
  fileId?: string
  fileType?: string
  isFolder: boolean
}

export interface ProjectInfo {
  projectTitle: string
  currentFile: string
}

/**
 * 获取项目标题
 */
export function getProjectTitle(): string {
  // 尝试多个可能的选择器
  const selectors = [
    '.project-name',
    '.header-project-name',
    'h1[data-testid="project-name"]',
    '.toolbar-left .project-name'
  ]
  
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element?.textContent?.trim()) {
      return element.textContent.trim()
    }
  }
  
  return document.title || 'Unknown Project'
}

/**
 * 获取当前打开的文件名
 */
export function getCurrentFileName(): string {
  // 尝试从文件树中找到当前选中的文件
  const activeItem = document.querySelector('.file-tree-inner li[role="treeitem"][aria-selected="true"]')
  if (activeItem) {
    const fileName = activeItem.getAttribute('aria-label')
    if (fileName) return fileName
  }
  
  // 尝试从编辑器标签获取
  const activeTab = document.querySelector('.file-tree .active')
  if (activeTab?.textContent?.trim()) {
    return activeTab.textContent.trim()
  }
  
  return 'main.tex'
}

/**
 * 获取项目基础信息
 */
export function getProjectInfo(): ProjectInfo {
  return {
    projectTitle: getProjectTitle(),
    currentFile: getCurrentFileName()
  }
}

/**
 * 检查是否为文本文件
 */
export function isTextFile(fileName: string): boolean {
  // const textExtensions = ['.tex', '.txt', '.md', '.py', '.js', '.ts', '.css', '.html', '.json', '.yml', '.yaml', '.xml', '.bib', '.cls', '.sty']
  const textExtensions = ['.tex', '.txt', '.md']
  return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext))
}


/**
 * 判断当前选中的树节点是否为文件（而非文件夹）
 */
export function isActiveTreeItemFile(): boolean {
  const activeItem = document.querySelector('.file-tree-inner li[role="treeitem"][aria-selected="true"]')
  if (!activeItem) return false

  const entityDiv = activeItem.querySelector('.entity')
  const fileType = entityDiv?.getAttribute('data-file-type') || ''
  const isFolder = fileType === 'folder'

  let fileName = activeItem.getAttribute('aria-label') || ''
  if (!fileName) {
    const nameButton = activeItem.querySelector('.item-name-button span')
    if (nameButton) {
      fileName = nameButton.textContent?.trim() || ''
    }
  }

  const hasExtension = /\.[^./]+$/.test(fileName)
  return !isFolder && hasExtension && isTextFile(fileName)
}



/**
 * 获取文件树中的所有文件项
 */
export function getFileTreeItems(): FileTreeItem[] {
  const fileItems: FileTreeItem[] = []
  
  // Overleaf 文件树选择器
  const selector = '.file-tree-inner li[role="treeitem"]'
  const items = document.querySelectorAll(selector)
  
  console.log(`Found ${items.length} file tree items`)
  
  items.forEach((item) => {
    // 获取文件名
    let fileName = item.getAttribute('aria-label')
    
    if (!fileName) {
      const nameButton = item.querySelector('.item-name-button span')
      if (nameButton) {
        fileName = nameButton.textContent?.trim() || ''
      }
    }
    
    if (!fileName) return
    
    // 检查是否为文件夹
    const entityDiv = item.querySelector('.entity')
    const fileType = entityDiv?.getAttribute('data-file-type') || ''
    const isFolder = fileType === 'folder'
    const hasExpandButton = item.querySelector('button[aria-label="Expand"]') !== null
    const hasExtension = /\.[^./]+$/.test(fileName)
    
    // 只处理有后缀的文本文件，避免误把文件夹当成文件
    if (!isFolder && !hasExpandButton && hasExtension && isTextFile(fileName)) {
      const clickElement = item.querySelector('.item-name-button') || item
      
      fileItems.push({
        name: fileName,
        path: fileName, // 简化版本，直接使用文件名作为路径
        element: clickElement,
        fileId: entityDiv?.getAttribute('data-file-id') || undefined,
        fileType: entityDiv?.getAttribute('data-file-type') || undefined,
        isFolder: false
      })
    }
  })
  
  console.log(`Found ${fileItems.length} text files`)
  return fileItems
}

/**
 * 点击文件树中的文件
 */
export async function clickFileTreeItem(item: FileTreeItem): Promise<boolean> {
  try {
    if (item.element instanceof HTMLElement) {
      item.element.click()
      return true
    }
    return false
  } catch (error) {
    console.error(`Failed to click file ${item.name}:`, error)
    return false
  }
}

/**
 * 等待文件加载完成
 */
export function waitForFileLoad(timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout)
  })
}
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.overleaf.com/*",
    "https://*.overleaf.com/*"
  ],
  world: "MAIN"
}
// import type { PlasmoCSConfig } from "plasmo"
