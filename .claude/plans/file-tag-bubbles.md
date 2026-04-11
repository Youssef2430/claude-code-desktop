# File Tag Bubbles in User Messages

## Goal
Render `@path/to/file` references in sent user messages as inline chips (icon + filename in a rounded bubble) instead of plain text.

## Changes

### 1. Export `getFileIcon` from `FileMentionMenu.tsx`
- Add `export` keyword to the existing `getFileIcon` function (line 35)
- No other changes needed in this file

### 2. Add inline file chip rendering in `ConversationView.tsx`

**Import `getFileIcon`:**
- Add import of `getFileIcon` from `./FileMentionMenu`
- Add import of `FolderSimple` from `@phosphor-icons/react` (for directory references)

**Add `renderUserContent()` function** (near the `UserMessage` component):
- Takes `text: string` and `colors` as parameters
- Uses regex `/(^|[\s])@([a-zA-Z0-9\/\-_.]+)/g` to find `@path` tokens
- Splits text into alternating segments: plain text and file-reference chips
- For each file reference, renders an inline `<span>` styled as a chip:
  - `display: inline-flex`, `align-items: center`, `gap: 4px`
  - Background: `colors.surfaceSecondary`, border: `colors.userBubbleBorder`
  - `border-radius: 6px`, `padding: 1px 6px`
  - File icon from `getFileIcon(filename)` + filename text
  - `vertical-align: baseline` so it flows naturally inline with text
- Returns a `<span>` wrapping all segments

**Update `UserMessage` component** (line 544):
- Replace `{displayText}` with `{renderUserContent(displayText, colors)}`

### 3. Handle edge cases
- Trailing `/` in path indicates a directory -- use `FolderSimple` icon
- Empty path after `@` (standalone `@`) -- render as plain text
- `@` in email addresses -- the regex requires path-like chars, so `user@example.com` won't false-match since the `@` must be preceded by whitespace or be at start of string
