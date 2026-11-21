import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DeltaBadgeProps {
  value: number
  variant?: 'badge' | 'default' | 'inline'
  suffix?: string
  precision?: number
  label?: string
  className?: string
  reverseColor?: boolean
}

export const DeltaBadge: React.FC<DeltaBadgeProps> = ({
  value,
  variant = 'badge',
  suffix = '%',
  precision = 1,
  label,
  className = '',
  reverseColor = false,
}) => {
  const isPositive = value > 0
  const isNegative = value < 0
  const isZero = value === 0

  const isGood = reverseColor ? isNegative : isPositive
  const isBad = reverseColor ? isPositive : isNegative

  const formatted = Math.abs(value).toFixed(precision)

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium tabular-nums ${
          isGood
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : isBad
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            : 'bg-muted text-muted-foreground border border-border'
        } ${className}`}
      >
        {isPositive && <TrendingUp className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />}
        {isNegative && <TrendingDown className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />}
        {isZero && <Minus className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />}
        <span>
          {isPositive ? '+' : isNegative ? '-' : ''}
          {formatted}
          {suffix}
        </span>
        {label && <span className="opacity-80 text-[11px] font-normal ml-0.5">{label}</span>}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs tabular-nums font-mono ${
        isGood
          ? 'text-emerald-600 dark:text-emerald-400'
          : isBad
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-muted-foreground'
      } ${className}`}
    >
      {isPositive && <TrendingUp className="w-3 h-3 shrink-0 stroke-[2.2]" />}
      {isNegative && <TrendingDown className="w-3 h-3 shrink-0 stroke-[2.2]" />}
      {isZero && <Minus className="w-3 h-3 shrink-0 stroke-[2.2]" />}
      <span className="font-medium">
        {isPositive ? '+' : isNegative ? '-' : ''}
        {formatted}
        {suffix}
      </span>
      {label && <span className="text-[11px] text-muted-foreground font-sans ml-0.5">{label}</span>}
    </span>
  )
}

export default DeltaBadge
