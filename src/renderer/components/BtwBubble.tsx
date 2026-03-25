import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpinnerGap } from '@phosphor-icons/react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'

const REMARK_PLUGINS = [remarkGfm]
const TRANSITION = { duration: 0.18, ease: [0.4, 0, 0.1, 1] as const }

export function BtwBubble() {
  const btwState = useSessionStore((s) => s.btwState)
  const dismissBtw = useSessionStore((s) => s.dismissBtw)
  const colors = useColors()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as response streams in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [btwState?.responseText])

  // Dismiss on Enter or Escape when done/error
  useEffect(() => {
    if (!btwState || (btwState.status !== 'done' && btwState.status !== 'error')) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        dismissBtw()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [btwState?.status, dismissBtw])

  return (
    <AnimatePresence>
      {btwState && (
        <motion.div
          data-clui-ui
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={TRANSITION}
          style={{ marginBottom: 8, zIndex: 12 }}
        >
          <div
            className="glass-surface no-drag"
            style={{
              borderRadius: 16,
              padding: '10px 14px',
              maxHeight: 240,
              overflowY: 'auto',
              border: `1px solid ${colors.containerBorder}`,
            }}
            ref={scrollRef}
          >
            {/* Question label + text */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  color: colors.accent,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                btw
              </span>
              <span style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.4 }}>
                {btwState.question}
              </span>
            </div>

            {/* Loading spinner */}
            {btwState.status === 'loading' && (
              <div style={{ padding: '4px 0' }}>
                <SpinnerGap size={14} className="animate-spin" style={{ color: colors.textTertiary }} />
              </div>
            )}

            {/* Streamed response */}
            {(btwState.status === 'streaming' || btwState.status === 'done') && btwState.responseText && (
              <div className="text-[13px] leading-[1.6] prose-cloud min-w-0" style={{ color: colors.textPrimary }}>
                <Markdown remarkPlugins={REMARK_PLUGINS}>
                  {btwState.responseText}
                </Markdown>
              </div>
            )}

            {/* Error */}
            {btwState.status === 'error' && (
              <span style={{ fontSize: 12, color: colors.statusError }}>
                {btwState.errorMessage || 'Something went wrong'}
              </span>
            )}

            {/* Dismiss hint */}
            {(btwState.status === 'done' || btwState.status === 'error') && (
              <div style={{ marginTop: 6, fontSize: 10, color: colors.textTertiary, opacity: 0.7 }}>
                Press Enter or Esc to dismiss
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
