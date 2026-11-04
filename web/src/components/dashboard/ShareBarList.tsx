import React from 'react'

export interface ShareBarItem {
  label: string
  value: number | string
  percentage: number
  color?: string
}

interface ShareBarListProps {
  items: ShareBarItem[]
  className?: string
  barColor?: string
}

export const ShareBarList: React.FC<ShareBarListProps> = ({
  items,
  className = '',
  barColor = '#f97316',
}) => {
  return (
    <ul
      className={`relative z-10 my-auto flex w-full flex-col gap-1 ${className}`}
      data-slot="share-bar-list"
    >
      {items.map((item) => {
        const clamped = Math.min(100, Math.max(0, item.percentage))
        const activeColor = item.color || barColor

        // Exact Efferd color-mix calculation
        const borderMixPercent = Math.min(100, Math.max(36, clamped * 1.75))
        const borderRightColor = `color-mix(in srgb, ${activeColor} ${borderMixPercent}%, transparent)`
        const fillStartColor = `color-mix(in srgb, ${activeColor} 4%, transparent)`
        const fillEndColor = `color-mix(in srgb, ${activeColor} 26%, transparent)`
        const backgroundImage = `linear-gradient(to right, ${fillStartColor}, ${fillEndColor})`

        return (
          <li
            key={item.label}
            className="group relative flex h-10 items-center gap-2 overflow-hidden px-3.5 rounded-lg transition-colors hover:bg-muted/30"
            data-slot="share-bar-list-item"
          >
            {/* Efferd Background fill track */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 h-full border-r-2 border-solid transition-all duration-500 ease-out"
              data-slot="share-bar-list-fill"
              style={{
                width: `${clamped}%`,
                borderRightColor,
                backgroundImage,
              }}
            />

            {/* Content Row floating cleanly on top */}
            <div
              className="z-10 flex w-full items-center justify-between gap-2 text-xs"
              data-slot="share-bar-list-content"
            >
              <span
                className="truncate font-medium text-foreground tracking-tight"
                data-slot="share-bar-list-label"
              >
                {item.label}
              </span>
              <span
                className="font-mono font-medium tabular-nums text-muted-foreground shrink-0"
                data-slot="share-bar-list-value"
              >
                {typeof item.value === 'number' ? `${item.value}%` : item.value}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default ShareBarList
