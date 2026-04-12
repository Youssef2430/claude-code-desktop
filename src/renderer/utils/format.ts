/**
 * Shared formatting utilities for displaying session metadata.
 * Used by SearchPanel, HistoryPicker, and other components that show session info.
 */

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/**
 * Derive a short project name from a full path or encoded directory name.
 *
 * Encoded: '-Users-foo-myproject' -> 'myproject'
 * Real:    '/Users/foo/myproject' -> 'myproject'
 */
export function shortPath(p: string): string {
  if (!p) return ''
  if (p.startsWith('-') && !p.includes('/')) {
    // Encoded directory name -- split on '-' and take the last segment
    const parts = p.split('-').filter(Boolean)
    return parts[parts.length - 1] || p
  }
  const parts = p.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || p
}

/**
 * Format a timestamp as relative time (e.g. "just now", "5 minutes ago", "2 days ago").
 */
export function timeAgo(timestamp: string): string {
  const then = new Date(timestamp).getTime()
  if (Number.isNaN(then)) return ''

  const diffSec = Math.floor((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'

  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
  ]

  for (let i = ranges.length - 1; i >= 0; i--) {
    const [unit, seconds] = ranges[i]
    if (diffSec >= seconds) {
      return relativeTimeFormatter.format(-Math.floor(diffSec / seconds), unit)
    }
  }

  return 'just now'
}
