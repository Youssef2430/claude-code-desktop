import { useThemeStore } from '../theme'

export function openInPreferredTerminal(sessionId: string | null, projectPath?: string): Promise<boolean> {
  return window.clui.openInTerminal(sessionId, projectPath, useThemeStore.getState().preferredTerminalId)
}
