/**
 * 替换块组件
 * 显示文件替换预览，支持用户接受或拒绝
 */
import { useState, useEffect, useMemo } from 'react'
import { Check, X, FileCode, AlertCircle, Loader2, ExternalLink, Eye } from 'lucide-react'
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
  return text.match(/\S+|\s+/g) || []
}

// 对差异部分进行单词级别的对比
function computeWordDiff(oldDiff: string, newDiff: string): {
  oldSegments: WordDiffSegment[]
  newSegments: WordDiffSegment[]
} {
  const oldTokens = tokenize(oldDiff)
  const newTokens = tokenize(newDiff)
  
  // LCS 算法
  const lcsMatrix: number[][] = []
  for (let i = 0; i <= oldTokens.length; i++) {
    lcsMatrix[i] = []
    for (let j = 0; j <= newTokens.length; j++) {
      if (i === 0 || j === 0) {
        lcsMatrix[i][j] = 0
      } else if (oldTokens[i - 1] === newTokens[j - 1]) {
        lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1
      } else {
        lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1])
      }
    }
  }
  
  let i = oldTokens.length
  let j = newTokens.length
  const oldMarked = new Array(oldTokens.length).fill(false)
  const newMarked = new Array(newTokens.length).fill(false)
  
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      oldMarked[i - 1] = true
      newMarked[j - 1] = true
      i--
      j--
    } else if (lcsMatrix[i - 1][j] > lcsMatrix[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  
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
  onNavigateToFile: (filePath: string) => void
  onShowInlineDiff?: (command: ReplaceCommand) => void // 在编辑器中显示内联差异
  isApplying?: boolean
}

export const ReplaceBlock = ({
  command,
  fileContent,
  onAccept,
  onReject,
  onNavigateToFile,
  onShowInlineDiff,
  isApplying = false
}: ReplaceBlockProps) => {
  const [matchInfo, setMatchInfo] = useState<{
    valid: boolean
    matchCount: number
    error?: string
  } | null>(null)
  
  // 验证匹配
  useEffect(() => {
    if (fileContent && command.status === 'pending') {
      const result = validateMatchCount(fileContent, command.search, command.isRegex)
      setMatchInfo(result)
    }
  }, [fileContent, command.search, command.isRegex, command.status])
  
  // 状态图标和样式
  const getStatusDisplay = () => {
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
  const hasValidMatch = matchInfo?.valid ?? true
  
  // 计算差异，用于高亮显示
  const diffData = useMemo(() => {
    const diff = computeDiff(command.search, command.replace || '')
    const { oldSegments, newSegments } = computeWordDiff(diff.oldDiff, diff.newDiff)
    return { diff, oldSegments, newSegments }
  }, [command.search, command.replace])
  
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
  
  return (
    <div className={`my-1.5 rounded-md border ${statusDisplay.bgColor} overflow-hidden text-xs`}>
      {/* 头部：文件名和状态 - 紧凑版 */}
      <div className={`px-2 py-1 flex items-center justify-between ${statusDisplay.bgColor}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <FileCode className="w-3 h-3 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">{command.file}</span>
          {command.isRegex && (
            <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded">
              正则
            </span>
          )}
          {matchInfo && (
            <span className={`text-[10px] ${matchInfo.valid ? 'text-green-600' : 'text-red-500'}`}>
              ({matchInfo.matchCount}处)
            </span>
          )}
          {statusDisplay.icon}
          {command.status === 'applied' && (
            <span className="text-[10px] text-green-600">已应用</span>
          )}
          {command.status === 'rejected' && (
            <span className="text-[10px] text-gray-500">已拒绝</span>
          )}
        </div>
      </div>
      
      {/* 替换内容预览 - 差异高亮版 */}
      <div className="px-2 py-1 bg-white/50 space-y-0.5">
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
        
        {/* 错误信息 */}
        {(command.errorMessage || (matchInfo && !matchInfo.valid)) && (
          <div className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-1 py-0.5 rounded">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{command.errorMessage || matchInfo?.error}</span>
          </div>
        )}
      </div>
      
      {/* 操作按钮 - 紧凑版 */}
      {isEditable && (
        <div className="px-2 py-1 bg-gray-50/50 flex items-center justify-between border-t border-gray-100">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] text-gray-500 hover:text-blue-600 h-6 px-1.5"
              onClick={() => onNavigateToFile(command.file)}
            >
              <ExternalLink className="w-3 h-3 mr-0.5" />
              查看
            </Button>
            
            {onShowInlineDiff && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] text-gray-500 hover:text-amber-600 hover:bg-amber-50 h-6 px-1.5"
                onClick={() => onShowInlineDiff(command)}
                disabled={isApplying}
              >
                <Eye className="w-3 h-3 mr-0.5" />
                预览
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 h-6 px-1.5"
              onClick={() => onReject(command)}
              disabled={isApplying}
            >
              <X className="w-3 h-3" />
            </Button>
            
            <Button
              variant="default"
              size="sm"
              className="text-[10px] bg-green-600 hover:bg-green-700 text-white h-6 px-2"
              onClick={() => onAccept(command)}
              disabled={isApplying || !hasValidMatch || command.status === 'error'}
            >
              {isApplying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Check className="w-3 h-3 mr-0.5" />
                  接受
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReplaceBlock

