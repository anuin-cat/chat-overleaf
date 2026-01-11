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

function getTreeItemLabel(item: Element | null): string {
  if (!item) return ''

  const ariaLabel = item.getAttribute('aria-label')
  if (ariaLabel?.trim()) return ariaLabel.trim()

  const nameButton = item.querySelector('.item-name-button span')
  return nameButton?.textContent?.trim() || ''
}

function buildTreeItemPath(item: Element | null): string {
  const itemName = getTreeItemLabel(item)
  if (!itemName) return ''

  const parts = [itemName]
  let parentList = item?.closest('ul.file-tree-folder-list')

  while (parentList) {
    const folderItem = parentList.previousElementSibling
    if (!folderItem || !folderItem.matches('li[role="treeitem"]')) break

    const folderName = getTreeItemLabel(folderItem)
    if (folderName) {
      parts.unshift(folderName)
    }

    parentList = folderItem.closest('ul.file-tree-folder-list')
  }

  return parts.join('/')
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
    const filePath = buildTreeItemPath(activeItem)
    if (filePath) return filePath
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
  const textExtensions = ['.tex', '.txt', '.md', '.bib']
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
 * 自动展开文件树中的所有文件夹，确保隐藏文件可见
 */
export async function expandAllFolders(maxRounds = 20, delayMs = 120): Promise<HTMLElement[]> {
  const treeRoot = document.querySelector('.file-tree-inner')
  if (!treeRoot) return []

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const toggledFolders: HTMLElement[] = []

  let round = 0
  while (round < maxRounds) {
    // 仅选择未展开的文件夹节点，避免重复点击
    const collapsedFolders = Array.from(
      treeRoot.querySelectorAll<HTMLLIElement>('li[role="treeitem"][aria-expanded="false"][aria-label]')
    ).filter(li => li.querySelector('.entity[data-file-type="folder"]'))

    if (collapsedFolders.length === 0) break

    // 兼容 Overleaf 的结构：折叠按钮是 div.folder-expand-collapse-button
    collapsedFolders.forEach(folder => {
      const toggle =
        folder.querySelector<HTMLElement>('.folder-expand-collapse-button') ||
        folder.querySelector<HTMLElement>('button[aria-label="Expand"]') ||
        folder.querySelector<HTMLElement>('button[aria-label="Expand folder"]')

      toggle?.click()
      toggledFolders.push(folder)

      // 滚动到视图，触发虚拟化加载
      if (toggle?.scrollIntoView) toggle.scrollIntoView({ block: 'nearest' })
    })

    round += 1
    // 等待 Overleaf 渲染子节点
    await sleep(delayMs)
  }

  return toggledFolders
}

/**
 * 折叠指定文件夹列表（通常是我们刚刚展开的那些）
 */
export async function collapseFolders(folders: HTMLElement[], delayMs = 120): Promise<void> {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  for (const folder of folders) {
    // 只处理当前已展开的
    if (folder.getAttribute('aria-expanded') !== 'true') continue

    const toggle =
      folder.querySelector<HTMLElement>('.folder-expand-collapse-button') ||
      folder.querySelector<HTMLElement>('button[aria-label="Collapse"]') ||
      folder.querySelector<HTMLElement>('button[aria-label="Collapse folder"]')

    toggle?.click()
    await sleep(delayMs)
  }
}


/**
 * 展开指定路径的所有父文件夹
 * @param filePath 文件路径，如 "chapter/A 第一章 绪论/1-背景和意义.tex"
 * @returns 是否成功展开所有需要的文件夹
 */
export async function expandPathFolders(filePath: string, delayMs = 150): Promise<boolean> {
  const treeRoot = document.querySelector('.file-tree-inner')
  if (!treeRoot) return false

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const pathParts = filePath.split('/')
  
  // 如果只有文件名（没有路径），无需展开
  if (pathParts.length <= 1) return true
  
  // 需要展开的文件夹路径（不包括文件名本身）
  const folderParts = pathParts.slice(0, -1)
  
  for (let i = 0; i < folderParts.length; i++) {
    const folderName = folderParts[i]
    const currentPath = folderParts.slice(0, i + 1).join('/')
    
    // 查找对应的文件夹节点
    const folderItems = Array.from(
      treeRoot.querySelectorAll<HTMLLIElement>('li[role="treeitem"]')
    ).filter(li => {
      const entityDiv = li.querySelector('.entity')
      if (entityDiv?.getAttribute('data-file-type') !== 'folder') return false
      
      // 检查文件夹名称
      const label = li.getAttribute('aria-label') || ''
      const nameSpan = li.querySelector('.item-name-button span')
      const name = label || nameSpan?.textContent?.trim() || ''
      
      // 匹配名称并检查路径层级
      if (name !== folderName) return false
      
      // 验证路径层级正确（通过父节点数量）
      let parentCount = 0
      let parentList = li.closest('ul.file-tree-folder-list')
      while (parentList) {
        const prevFolder = parentList.previousElementSibling
        if (prevFolder?.matches('li[role="treeitem"]')) {
          parentCount++
        }
        parentList = prevFolder?.closest('ul.file-tree-folder-list') || null
      }
      
      return parentCount === i
    })
    
    if (folderItems.length === 0) {
      console.warn(`[ChatOverleaf] Folder not found: ${folderName} in path: ${currentPath}`)
      return false
    }
    
    const folder = folderItems[0]
    const isExpanded = folder.getAttribute('aria-expanded') === 'true'
    
    if (!isExpanded) {
      const toggle = folder.querySelector<HTMLElement>('.folder-expand-collapse-button') ||
        folder.querySelector<HTMLElement>('button[aria-label="Expand"]')
      
      if (toggle) {
        toggle.click()
        await sleep(delayMs)
      }
    }
  }
  
  return true
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
    let fileName = getTreeItemLabel(item)
    
    if (!fileName) return
    
    // 检查是否为文件夹
    const entityDiv = item.querySelector('.entity')
    const fileType = entityDiv?.getAttribute('data-file-type') || ''
    const isFolder = fileType === 'folder'
    const hasExpandButton =
      item.querySelector('.folder-expand-collapse-button') !== null ||
      item.querySelector('button[aria-label="Expand"]') !== null ||
      item.querySelector('button[aria-label="Expand folder"]') !== null
    const hasExtension = /\.[^./]+$/.test(fileName)
    
    // 只处理有后缀的文本文件，避免误把文件夹当成文件
    if (!isFolder && !hasExpandButton && hasExtension && isTextFile(fileName)) {
      const clickElement = item.querySelector('.item-name-button') || item
      
      const filePath = buildTreeItemPath(item) || fileName
      fileItems.push({
        name: filePath,
        path: filePath,
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
