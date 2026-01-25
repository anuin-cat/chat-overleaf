/**
 * 替换块组件
 * 显示文件替换预览，支持用户接受或拒绝
 */
import { useState, useEffect, useMemo } from 'react'
import { Check, X, FileCode, AlertCircle, Loader2, MousePointerClick, FilePlus } from 'lucide-react'
import { Button } from '~components/ui/button'
import type { ReplaceCommand } from '~lib/replace-service'
import { validateMatchCount } from '~lib/replace-service'

// ============ 差异对比算法 ============

interface DiffResult {
  commonPrefix: string
  commonSuffix: string
  oldDiff: string
  newDiff: string
}

interface WordDiffSegment {
  text: string
  type: 'same' | 'changed'
}

// 计算两个字符串的首尾相同部分和差异部分
function computeDiff(oldText: string, newText: string): DiffResult {
  let prefixLen = 0
  const minLen = Math.min(oldText.length, newText.length)
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++
  }
  
  let suffixLen = 0
  const maxSuffixLen = minLen - prefixLen
  while (
    suffixLen < maxSuffixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++
  }
  
  return {
    commonPrefix: oldText.substring(0, prefixLen),
    commonSuffix: suffixLen > 0 ? oldText.substring(oldText.length - suffixLen) : '',
    oldDiff: oldText.substring(prefixLen, oldText.length - suffixLen),
    newDiff: newText.substring(prefixLen, newText.length - suffixLen)
  }
}

// 将文本分割成单词和非单词部分
function tokenize(text: string): string[] {
  if (!text) return []
  // 更细粒度的分词：CJK 单字、单词/数字、标点、空白分别成块
  const regex = /(\r\n|\r|\n)|(\s+)|(\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul})|([\p{L}\p{M}\p{N}_]+)|(\p{Extended_Pictographic})|([^\s])/gu
  const tokens: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0])
  }
  return tokens
}

// 对差异部分进行单词级别的对比
function computeWordDiff(oldDiff: string, newDiff: string): {
  oldSegments: WordDiffSegment[]
  newSegments: WordDiffSegment[]
} {
  const oldTokens = tokenize(oldDiff)
  const newTokens = tokenize(newDiff)
  
  const oldMarked = new Array(oldTokens.length).fill(false)
  const newMarked = new Array(newTokens.length).fill(false)

  const markWithLcs = (
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number
  ) => {
    const oldLen = oldEnd - oldStart
    const newLen = newEnd - newStart
    if (oldLen <= 0 || newLen <= 0) return

    const lcsMatrix: number[][] = []
    for (let i = 0; i <= oldLen; i++) {
      lcsMatrix[i] = []
      for (let j = 0; j <= newLen; j++) {
        if (i === 0 || j === 0) {
          lcsMatrix[i][j] = 0
        } else if (oldTokens[oldStart + i - 1] === newTokens[newStart + j - 1]) {
          lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1
        } else {
          lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1])
        }
      }
    }

    let i = oldLen
    let j = newLen
    while (i > 0 && j > 0) {
      const oldToken = oldTokens[oldStart + i - 1]
      const newToken = newTokens[newStart + j - 1]
      if (oldToken === newToken) {
        oldMarked[oldStart + i - 1] = true
        newMarked[newStart + j - 1] = true
        i--
        j--
      } else if (lcsMatrix[i - 1][j] > lcsMatrix[i][j - 1]) {
        i--
      } else if (lcsMatrix[i - 1][j] < lcsMatrix[i][j - 1]) {
        j--
      } else {
        // 平局时优先缩短跨度，避免错位
        const oldPrev = oldTokens[oldStart + i - 1]
        const newPrev = newTokens[newStart + j - 1]
        const oldInNew = newTokens.lastIndexOf(oldPrev, newStart + j - 2)
        const newInOld = oldTokens.lastIndexOf(newPrev, oldStart + i - 2)
        if (oldInNew === -1 && newInOld === -1) {
          i--
        } else if (oldInNew === -1) {
          j--
        } else if (newInOld === -1) {
          i--
        } else {
          const distOld = oldStart + i - 1 - newInOld
          const distNew = newStart + j - 1 - oldInNew
          if (distOld <= distNew) {
            i--
          } else {
            j--
          }
        }
      }
    }
  }

  const getPatienceAnchors = (
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number
  ) => {
    const oldCount = new Map<string, number>()
    const newCount = new Map<string, number>()
    for (let i = oldStart; i < oldEnd; i++) {
      const token = oldTokens[i]
      oldCount.set(token, (oldCount.get(token) || 0) + 1)
    }
    for (let j = newStart; j < newEnd; j++) {
      const token = newTokens[j]
      newCount.set(token, (newCount.get(token) || 0) + 1)
    }

    const newUniqueIndex = new Map<string, number>()
    for (let j = newStart; j < newEnd; j++) {
      const token = newTokens[j]
      if (newCount.get(token) === 1) {
        newUniqueIndex.set(token, j)
      }
    }

    const pairs: Array<{ oldIndex: number; newIndex: number }> = []
    for (let i = oldStart; i < oldEnd; i++) {
      const token = oldTokens[i]
      const newIndex = newUniqueIndex.get(token)
      if (oldCount.get(token) === 1 && newIndex !== undefined) {
        pairs.push({ oldIndex: i, newIndex })
      }
    }

    pairs.sort((a, b) => a.oldIndex - b.oldIndex)
    if (pairs.length === 0) return []

    const dp = new Array(pairs.length).fill(1)
    const prev = new Array(pairs.length).fill(-1)
    let bestIdx = 0

    for (let i = 0; i < pairs.length; i++) {
      for (let j = 0; j < i; j++) {
        if (pairs[j].newIndex < pairs[i].newIndex && dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1
          prev[i] = j
        }
      }
      if (dp[i] > dp[bestIdx]) {
        bestIdx = i
      }
    }

    const anchors: Array<{ oldIndex: number; newIndex: number }> = []
    let k = bestIdx
    while (k !== -1) {
      anchors.push(pairs[k])
      k = prev[k]
    }
    anchors.reverse()
    return anchors
  }

  const markMatches = (
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number
  ) => {
    if (oldStart >= oldEnd || newStart >= newEnd) return
    const anchors = getPatienceAnchors(oldStart, oldEnd, newStart, newEnd)
    if (anchors.length === 0) {
      markWithLcs(oldStart, oldEnd, newStart, newEnd)
      return
    }

    let prevOld = oldStart
    let prevNew = newStart
    for (const anchor of anchors) {
      markMatches(prevOld, anchor.oldIndex, prevNew, anchor.newIndex)
      oldMarked[anchor.oldIndex] = true
      newMarked[anchor.newIndex] = true
      prevOld = anchor.oldIndex + 1
      prevNew = anchor.newIndex + 1
    }
    markMatches(prevOld, oldEnd, prevNew, newEnd)
  }

  markMatches(0, oldTokens.length, 0, newTokens.length)
  
  const oldSegments: WordDiffSegment[] = oldTokens.map((text, k) => ({
    text,
    type: oldMarked[k] ? 'same' : 'changed'
  }))
  
  const newSegments: WordDiffSegment[] = newTokens.map((text, k) => ({
    text,
    type: newMarked[k] ? 'same' : 'changed'
  }))
  
  return { oldSegments, newSegments }
}

interface ReplaceBlockProps {
  command: ReplaceCommand
  fileContent?: string // 当前文件内容（用于验证匹配）
  onAccept: (command: ReplaceCommand) => void
  onReject: (command: ReplaceCommand) => void
  onUndoApply?: (command: ReplaceCommand) => void
  onUndoReject?: (command: ReplaceCommand) => void
  onSmartPreview?: (command: ReplaceCommand) => void // 智能预览：自动判断查看或预览
  isApplying?: boolean
}

export const ReplaceBlock = ({
  command,
  fileContent,
  onAccept,
  onReject,
  onUndoApply,
  onUndoReject,
  onSmartPreview,
  isApplying = false
}: ReplaceBlockProps) => {
  const isCreateCommand = command.commandType === 'create'
  const [matchInfo, setMatchInfo] = useState<{
    valid: boolean
    matchCount: number
    error?: string
  } | null>(null)
  
  // 验证匹配（基于清洗后的内容）
  useEffect(() => {
    if (typeof fileContent === 'string' && command.status === 'pending' && !isCreateCommand) {
      // fileContent 为 cleanContent（注释块已折叠为占位符），校验逻辑需与编辑器侧保持一致
      const result = validateMatchCount(fileContent, command.search, command.isRegex)
      setMatchInfo(result)
    }
  }, [fileContent, command.search, command.isRegex, command.status, isCreateCommand])
  
  // 状态图标和样式
  const getStatusDisplay = () => {
    if (isCreateCommand) {
      switch (command.status) {
        case 'pending':
          return {
            icon: null,
            bgColor: 'bg-purple-50 border-purple-200',
            textColor: 'text-purple-700'
          }
        case 'accepted':
        case 'applied':
          return {
            icon: <Check className="w-4 h-4 text-green-600" />,
            bgColor: 'bg-purple-50 border-purple-200',
            textColor: 'text-purple-700'
          }
        case 'rejected':
          return {
            icon: <X className="w-4 h-4 text-gray-400" />,
            bgColor: 'bg-gray-50 border-gray-200',
            textColor: 'text-gray-500'
          }
        case 'error':
          return {
            icon: <AlertCircle className="w-4 h-4 text-red-500" />,
            bgColor: 'bg-red-50 border-red-200',
            textColor: 'text-red-600'
          }
      }
    }
    switch (command.status) {
      case 'pending':
        return {
          icon: null,
          bgColor: 'bg-amber-50 border-amber-200',
          textColor: 'text-amber-700'
        }
      case 'accepted':
      case 'applied':
        return {
          icon: <Check className="w-4 h-4 text-green-600" />,
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-700'
        }
      case 'rejected':
        return {
          icon: <X className="w-4 h-4 text-gray-400" />,
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-500'
        }
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-600'
        }
    }
  }
  
  const statusDisplay = getStatusDisplay()
  const isEditable = command.status === 'pending'
  const canUndoApply = (command.status === 'applied' || command.status === 'accepted') && !!onUndoApply && !isCreateCommand
  const canUndoReject = command.status === 'rejected' && !!onUndoReject
  const hasValidMatch = isCreateCommand ? true : (matchInfo?.valid ?? true)
  
  // 计算差异，用于高亮显示
  const diffData = useMemo(() => {
    if (isCreateCommand) {
      return {
        diff: { commonPrefix: '', commonSuffix: '', oldDiff: '', newDiff: '' },
        oldSegments: [],
        newSegments: []
      }
    }
    const diff = computeDiff(command.search, command.replace || '')
    const { oldSegments, newSegments } = computeWordDiff(diff.oldDiff, diff.newDiff)
    return { diff, oldSegments, newSegments }
  }, [command.search, command.replace, isCreateCommand])
  
  // 渲染带有差异高亮的文本
  const renderDiffText = (
    segments: WordDiffSegment[],
    prefix: string,
    suffix: string,
    type: 'old' | 'new'
  ) => {
    const baseClass = type === 'old' ? 'bg-red-100' : 'bg-green-100'
    const changedClass = type === 'old' ? 'bg-red-300 text-red-900' : 'bg-green-300 text-green-900'
    
    return (
      <>
        {prefix && <span className="text-gray-400">{prefix}</span>}
        {segments.map((seg, idx) => (
          <span
            key={idx}
            className={seg.type === 'changed' ? changedClass : baseClass}
          >
            {seg.text}
          </span>
        ))}
        {suffix && <span className="text-gray-400">{suffix}</span>}
      </>
    )
  }
  
  // 是否只显示差异部分
  const hasDiff = diffData.diff.oldDiff.length > 0 || diffData.diff.newDiff.length > 0
  const showCompact = hasDiff && (diffData.diff.commonPrefix.length > 10 || diffData.diff.commonSuffix.length > 10)
  const isImplicitInsert = !isCreateCommand &&
    command.commandType === 'replace' &&
    diffData.diff.oldDiff.length === 0 &&
    diffData.diff.newDiff.length > 0
  const isInsertLike = command.commandType === 'insert' || isImplicitInsert
  
  return (
    <div className={`my-1.5 rounded-md border ${statusDisplay.bgColor} overflow-hidden text-xs`}>
      {/* 头部：文件名和状态 - 紧凑版 */}
      <div className={`px-2 py-1 flex items-center justify-between ${statusDisplay.bgColor}`}>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {isCreateCommand ? (
            <FilePlus className="w-3 h-3 text-purple-600 flex-shrink-0" />
          ) : (
            <FileCode className="w-3 h-3 text-gray-500 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-700 truncate">{command.file}</span>
          {isCreateCommand && (
            <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-700 rounded flex-shrink-0">
              新建
            </span>
          )}
          {isInsertLike && (
            <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded flex-shrink-0">
              插入
            </span>
          )}
          {command.isRegex && (
            <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded flex-shrink-0">
              正则
            </span>
          )}
          {matchInfo && !isCreateCommand && (
            <span className={`text-[10px] flex-shrink-0 ${matchInfo.valid ? 'text-green-600' : 'text-red-500'}`}>
              ({matchInfo.matchCount}处)
            </span>
          )}
          {statusDisplay.icon}
          {command.status === 'applied' && (
            <span className="text-[10px] text-green-600 flex-shrink-0">已应用</span>
          )}
          {command.status === 'rejected' && (
            <span className="text-[10px] text-gray-500 flex-shrink-0">已拒绝</span>
          )}
        </div>
        {/* 操作按钮组 - 右上角 */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isEditable && onSmartPreview && !isCreateCommand && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 h-5 w-5 p-0"
              onClick={() => onSmartPreview(command)}
              disabled={isApplying}
              title="点击定位到文件并预览修改"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
            </Button>
          )}
          {isEditable && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-red-600 hover:bg-red-50 h-5 w-5 p-0"
                onClick={() => onReject(command)}
                disabled={isApplying}
                title="拒绝"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="default"
                size="sm"
                className={`text-[10px] text-white h-5 px-1.5 ${
                  isCreateCommand ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'
                }`}
                onClick={() => onAccept(command)}
                disabled={isApplying || !hasValidMatch || command.status === 'error'}
                title={isCreateCommand ? "创建" : "接受"}
              >
                {isApplying ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3 h-3 mr-0.5" />
                    {isCreateCommand ? '创建' : '接受'}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* 替换/插入内容预览 */}
      <div className="px-2 py-1 bg-white/50 space-y-0.5">
        {/* 创建文件：显示内容 */}
        {isCreateCommand ? (
          <div className="flex items-start gap-1">
            <span className="w-1 h-1 rounded-full bg-purple-400 mt-1.5 flex-shrink-0"></span>
            <div className="flex-1">
              <span className="text-[10px] text-purple-600 mr-1">文件内容</span>
              <pre className="text-[11px] text-purple-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-purple-100 leading-tight bg-purple-50/50">
                {command.replace || '(空)'}
              </pre>
            </div>
          </div>
        ) : isInsertLike ? (
          <>
            {/* AFTER 锚点 */}
            {command.commandType === 'insert' && command.insertAnchor?.after && (
              <div className="flex items-start gap-1">
                <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></span>
                <div className="flex-1">
                  <span className="text-[10px] text-blue-500 mr-1">AFTER ↓</span>
                  <pre className="text-[11px] text-blue-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-blue-100 leading-tight bg-blue-50/50">
                    {command.insertAnchor.after}
                  </pre>
                </div>
              </div>
            )}
            {/* 由 diff 推断的插入：显示定位文本 */}
            {isImplicitInsert && (
              <div className="flex items-start gap-1">
                <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></span>
                <div className="flex-1">
                  <span className="text-[10px] text-blue-500 mr-1">定位文本</span>
                  <pre className="text-[11px] text-blue-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-blue-100 leading-tight bg-blue-50/50">
                    {command.search || '(空)'}
                  </pre>
                </div>
              </div>
            )}
            {/* 插入内容 */}
            <div className="flex items-start gap-1">
              <span className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0"></span>
              <div className="flex-1">
                <span className="text-[10px] text-green-500 mr-1">插入内容</span>
                <pre className="text-[11px] text-green-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-green-100 leading-tight bg-green-50/50">
                  {isImplicitInsert ? (diffData.diff.newDiff || command.replace || '(空)') : (command.replace || '(空)')}
                </pre>
              </div>
            </div>
            {/* BEFORE 锚点 */}
            {command.commandType === 'insert' && command.insertAnchor?.before && (
              <div className="flex items-start gap-1">
                <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></span>
                <div className="flex-1">
                  <span className="text-[10px] text-blue-500 mr-1">↑ BEFORE</span>
                  <pre className="text-[11px] text-blue-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-blue-100 leading-tight bg-blue-50/50">
                    {command.insertAnchor.before}
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 原始内容 - 只显示差异部分 */}
            <div className="flex items-start gap-1">
              <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></span>
              <pre className="text-[11px] text-red-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-red-100 flex-1 leading-tight bg-red-50/50">
                {showCompact ? (
                  renderDiffText(
                    diffData.oldSegments,
                    diffData.diff.commonPrefix.length > 10 ? '...' : diffData.diff.commonPrefix,
                    diffData.diff.commonSuffix.length > 10 ? '...' : diffData.diff.commonSuffix,
                    'old'
                  )
                ) : hasDiff ? (
                  renderDiffText(diffData.oldSegments, diffData.diff.commonPrefix, diffData.diff.commonSuffix, 'old')
                ) : (
                  command.search
                )}
              </pre>
            </div>
            
            {/* 新内容 - 只显示差异部分 */}
            <div className="flex items-start gap-1">
              <span className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0"></span>
              <pre className="text-[11px] text-green-700 px-1 py-0.5 rounded overflow-x-auto whitespace-pre-wrap break-all font-mono border border-green-100 flex-1 leading-tight bg-green-50/50">
                {command.replace ? (
                  showCompact ? (
                    renderDiffText(
                      diffData.newSegments,
                      diffData.diff.commonPrefix.length > 10 ? '...' : diffData.diff.commonPrefix,
                      diffData.diff.commonSuffix.length > 10 ? '...' : diffData.diff.commonSuffix,
                      'new'
                    )
                  ) : hasDiff ? (
                    renderDiffText(diffData.newSegments, diffData.diff.commonPrefix, diffData.diff.commonSuffix, 'new')
                  ) : (
                    command.replace
                  )
                ) : (
                  '(空)'
                )}
              </pre>
            </div>
          </>
        )}
        
        {/* 错误信息 */}
        {(command.errorMessage || (matchInfo && !matchInfo.valid)) && (
          <div className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-1 py-0.5 rounded">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{command.errorMessage || matchInfo?.error}</span>
          </div>
        )}
      </div>

      {/* 已处理状态的操作区 */}
      {!isEditable && (
        <div className="px-2 py-1 border-t border-gray-100 bg-white flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1 text-gray-600">
            {statusDisplay.icon}
            <span>
              {command.status === 'applied' || command.status === 'accepted'
                ? (isCreateCommand ? '已创建' : '已应用，支持撤销恢复为候选')
                : command.status === 'rejected'
                  ? '已拒绝，支持撤销恢复为候选'
                  : '已处理'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {canUndoApply && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => onUndoApply?.(command)}
                title="撤销应用，恢复为待处理并重新高亮"
              >
                撤销应用
              </Button>
            )}
            {canUndoReject && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => onUndoReject?.(command)}
                title="撤销拒绝，恢复为待处理并重新高亮"
              >
                撤销拒绝
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReplaceBlock
