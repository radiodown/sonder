import Highlight from '@tiptap/extension-highlight'

export const HIGHLIGHT_COLORS = [
  { label: '노란색', color: '#facc1566' },
  { label: '분홍색', color: '#fb718566' },
  { label: '초록색', color: '#4ade8066' },
  { label: '파란색', color: '#60a5fa66' },
  { label: '보라색', color: '#c084fc66' },
]

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].color

export const ReviewHighlight = Highlight.extend({
  addStorage() {
    return { color: DEFAULT_HIGHLIGHT_COLOR }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setHighlightColor: (color) => ({ dispatch }) => {
        if (dispatch) this.storage.color = color
        return true
      },
    }
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () =>
        this.editor.commands.toggleHighlight({
          color: this.editor.getAttributes('highlight').color || this.storage.color,
        }),
    }
  },
}).configure({ multicolor: true })
