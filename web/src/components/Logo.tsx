/**
 * Placeholder wordmark. Swap for the real BGSC/BGEC/FitSoc SVG assets when
 * branding is finalized (spec §3.1 contextual logo).
 */
export function Logo({ label = 'BGSC' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-sm text-white">
        {label.slice(0, 2)}
      </span>
      <span className="text-slate-900 dark:text-slate-100">{label} Admin</span>
    </span>
  )
}
