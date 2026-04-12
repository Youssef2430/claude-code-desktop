/**
 * SearchManager — main-process coordinator for the search worker.
 *
 * Spawns a worker_threads Worker lazily on first use, proxies IPC
 * messages, and handles worker lifecycle (crash recovery, shutdown).
 */

import { Worker } from 'worker_threads'
import { join } from 'path'
import type { SearchResult, SearchIndexStatus } from '../../shared/types'

export class SearchManager {
  private worker: Worker | null = null
  private indexReady = false
  private building = false
  private nextRequestId = 1
  private pendingSearches = new Map<number, { resolve: (results: SearchResult[]) => void; reject: (err: Error) => void }>()
  private onStatus: (status: SearchIndexStatus) => void

  constructor(onStatus: (status: SearchIndexStatus) => void) {
    this.onStatus = onStatus
  }

  /** Spawn worker and kick off index build. Idempotent. */
  ensureReady(): void {
    if (this.worker) {
      // Worker alive — if index isn't building yet, trigger it
      if (!this.indexReady && !this.building) {
        this.building = true
        this.worker.postMessage({ type: 'build-index' })
      }
      return
    }

    // Spawn the worker from the compiled output.
    // Both index.js and search-worker.js are emitted flat into dist/main/.
    const workerPath = join(__dirname, 'search-worker.js')
    this.worker = new Worker(workerPath)
    this.building = true

    this.worker.on('message', (msg: any) => {
      switch (msg.type) {
        case 'ready':
          // Worker script loaded — start indexing
          this.worker!.postMessage({ type: 'build-index' })
          break

        case 'index-status':
          if (msg.status.state === 'ready') {
            this.indexReady = true
            this.building = false
          } else if (msg.status.state === 'error') {
            this.building = false
          }
          this.onStatus(msg.status as SearchIndexStatus)
          break

        case 'search-results': {
          const pending = this.pendingSearches.get(msg.requestId as number)
          if (pending) {
            this.pendingSearches.delete(msg.requestId as number)
            pending.resolve(msg.results as SearchResult[])
          }
          break
        }
      }
    })

    this.worker.on('error', (err) => {
      this.onStatus({ state: 'error', error: `Worker error: ${err.message}` })
      this.rejectAllPending(err)
      this.cleanup()
    })

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.onStatus({ state: 'error', error: `Worker exited with code ${code}` })
        this.rejectAllPending(new Error(`Worker exited with code ${code}`))
      }
      this.cleanup()
    })
  }

  /** Search the index. Returns empty array if index isn't ready yet. */
  async search(query: string, topK = 10): Promise<SearchResult[]> {
    if (!this.worker) {
      this.ensureReady()
    }

    if (!this.indexReady) {
      // Index is still building — return empty for now
      return []
    }

    const requestId = this.nextRequestId++

    return new Promise<SearchResult[]>((resolve, reject) => {
      this.pendingSearches.set(requestId, { resolve, reject })
      this.worker!.postMessage({ type: 'search', query, topK, requestId })

      // Timeout: don't hang forever
      setTimeout(() => {
        if (this.pendingSearches.has(requestId)) {
          this.pendingSearches.delete(requestId)
          resolve([]) // Timeout → empty results, don't crash
        }
      }, 10_000)
    })
  }

  /** Gracefully shut down the worker. */
  dispose(): void {
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'shutdown' })
      } catch { /* already dead */ }
      setTimeout(() => {
        try { this.worker?.terminate() } catch { /* ignore */ }
      }, 1000)
    }
    this.rejectAllPending(new Error('SearchManager disposed'))
    this.cleanup()
  }

  private cleanup(): void {
    this.worker = null
    this.indexReady = false
    this.building = false
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingSearches.values()) {
      pending.resolve([]) // Resolve with empty rather than rejecting — no UI errors
    }
    this.pendingSearches.clear()
  }
}
