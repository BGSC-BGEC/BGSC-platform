import { useThemeStore } from '../core/stores/themeStore'

const LABELS: Record<string, string> = {
  light: '☀️ Light',
  dark: '🌙 Dark',
  system: '💻 System',
}

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const toggle = useThemeStore((s) => s.toggle)

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme (light → dark → system)"
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {LABELS[mode]}
    </button>
  )
}
