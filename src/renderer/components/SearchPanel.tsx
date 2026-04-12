import React, { useState, useCallback, useRef, useEffect } from 'react'
import { MagnifyingGlass, SpinnerGap, X, Clock, FolderOpen } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'
import type { SearchResult } from '../../shared/types'

/** Derive a short project name from a full path or encoded dir. */
function shortPath(p: string): string {
  if (!p) return ''
  // Encoded dir name like "-Users-foo-bar" → last segment
  if (p.startsWith('-') && !p.includes('/')) {
    const parts = p.split('-').filter(Boolean)
    return parts[parts.length - 1] || p
  }
  // Real path → last directory name
  const parts = p.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || p
}

/** Format a timestamp as relative time. */
function timeAgo(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  if (diffSec < 2592000) return `${Math.floor(diffSec / 604800)}w ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function SearchPanel() {
  const colors = useColors()
  const closeSearchPanel = useSessionStore((s) => s.closeSearchPanel)
  const indexStatus = useSessionStore((s) => s.searchIndexStatus)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Autofocus on mount
  useEffect(() => {
    // Small delay to let the motion animation start
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearching(false)
      setHasSearched(false)
      return
    }
    setSearching(true)
    try {
      const res = await window.clui.searchSessions(q.trim())
      setResults(res)
      setHasSearched(true)
    } catch {
      setResults([])
      setHasSearched(true)
    } finally {
      setSearching(false)
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }, [doSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSearchPanel()
    }
  }, [closeSearchPanel])

  const handleResultClick = useCallback((result: SearchResult) => {
    const title = result.firstMessage?.substring(0, 30) || result.slug || 'Search Result'
    useSessionStore.getState().resumeSession(result.sessionId, title, result.projectPath)
    closeSearchPanel()
  }, [closeSearchPanel])

  const isIndexing = indexStatus.state === 'indexing'
  const isError = indexStatus.state === 'error'
  const isIdle = indexStatus.state === 'idle'

  // Filter out low-relevance results (below a minimum score threshold)
  const meaningful = results.filter((r) => r.score > 0.15)

  return (
    <div
      data-clui-ui
      onKeyDown={handleKeyDown}
      style={{
        height: 470,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Header ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px 0 16px',
          flexShrink: 0,
        }}
      >
        <MagnifyingGlass size={18} weight="bold" style={{ color: colors.accent, flexShrink: 0 }} />
        <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
          Search Conversations
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={closeSearchPanel}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            color: colors.textTertiary,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <X size={16} />
        </button>
      </div>

      {/* ─── Search input ─── */}
      <div style={{ padding: '10px 16px 6px 16px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: colors.surfacePrimary,
            borderRadius: 10,
            padding: '8px 12px',
            border: `1px solid ${colors.inputBorder}`,
          }}
        >
          {searching ? (
            <SpinnerGap size={15} className="animate-spin" style={{ color: colors.textTertiary, flexShrink: 0 }} />
          ) : (
            <MagnifyingGlass size={15} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search by meaning or keyword..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: colors.textPrimary,
              fontSize: 13,
              lineHeight: '18px',
            }}
          />
        </div>
      </div>

      {/* ─── Status bar ─── */}
      {(isIndexing || isError || isIdle) && (
        <div style={{ padding: '2px 16px 4px 16px', flexShrink: 0 }}>
          {isIndexing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: colors.textTertiary }}>
              <SpinnerGap size={12} className="animate-spin" />
              <span>
                Indexing conversations...{' '}
                {indexStatus.total ? `${indexStatus.indexed || 0}/${indexStatus.total}` : ''}
              </span>
            </div>
          )}
          {isError && (
            <div style={{ fontSize: 11, color: colors.statusError }}>
              {indexStatus.error || 'Search index error'}
            </div>
          )}
          {isIdle && query.trim() && (
            <div style={{ fontSize: 11, color: colors.textTertiary }}>
              Preparing search index...
            </div>
          )}
        </div>
      )}

      {/* ─── Results ─── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 8px 12px 8px',
        }}
        className="custom-scrollbar"
      >
        {/* Empty state — no query */}
        {!query.trim() && !hasSearched && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 8,
            padding: '40px 20px',
          }}>
            <MagnifyingGlass size={32} weight="thin" style={{ color: colors.textTertiary, opacity: 0.5 }} />
            <span style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
              Search across all your past conversations by meaning or keywords
            </span>
            <span style={{ color: colors.textTertiary, fontSize: 11, opacity: 0.6 }}>
              Cmd+Shift+F
            </span>
          </div>
        )}

        {/* Empty state — no results */}
        {query.trim() && hasSearched && !searching && meaningful.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 6,
            padding: '40px 20px',
          }}>
            <span style={{ color: colors.textTertiary, fontSize: 13 }}>
              No matching conversations found
            </span>
            {isIndexing && (
              <span style={{ color: colors.textTertiary, fontSize: 11, opacity: 0.7 }}>
                Try again after indexing completes
              </span>
            )}
          </div>
        )}

        {/* Results list */}
        {meaningful.map((result) => (
          <button
            key={result.sessionId}
            onClick={() => handleResultClick(result)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 10px',
              borderRadius: 10,
              marginBottom: 2,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            {/* Snippet */}
            <div
              style={{
                color: colors.textPrimary,
                fontSize: 13,
                lineHeight: '18px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {result.snippet}
            </div>

            {/* Meta row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 5,
                fontSize: 11,
                color: colors.textTertiary,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <FolderOpen size={11} />
                {shortPath(result.projectPath)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} />
                {timeAgo(result.lastTimestamp)}
              </span>
              {/* Relevance indicator — subtle bar */}
              <div style={{ flex: 1 }} />
              <div
                style={{
                  width: 32,
                  height: 3,
                  borderRadius: 2,
                  background: colors.surfaceSecondary,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.round(result.score * 100))}%`,
                    height: '100%',
                    borderRadius: 2,
                    background: colors.accent,
                    opacity: 0.6 + result.score * 0.4,
                  }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
