import React, { useState, useId } from 'react'

export interface MonthData {
  month: string
  shortMonth: string
  value: number
}

interface ActivityAreaChartProps {
  data: MonthData[]
  height?: number
  color?: string
}

export const ActivityAreaChart: React.FC<ActivityAreaChartProps> = ({
  data,
  height = 220,
  color = '#f97316',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const rawId = useId().replace(/[:]/g, '')
  const gradientId = `area-grad-${rawId}`

  if (!data || data.length === 0) return null

  const width = 800
  const paddingTop = 20
  const paddingBottom = 30
  const paddingLeft = 30
  const paddingRight = 30

  const chartW = width - paddingLeft - paddingRight
  const chartH = height - paddingTop - paddingBottom

  const values = data.map((d) => d.value)
  const maxVal = Math.max(...values, 100)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  // Map data to coordinates
  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartW
    const y = paddingTop + chartH - ((d.value - minVal) / range) * chartH
    return { x, y, data: d }
  })

  // Smooth Bezier Curve Path
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[0]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const linePath = buildSmoothPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ height: 'auto', maxHeight: height }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="60%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Horizontal subtle grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + chartH * ratio
          return (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="currentColor"
              className="text-slate-200 dark:text-white/[0.06]"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )
        })}

        {/* Shaded Area */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Outline Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points & X-axis labels */}
        {points.map((pt, i) => {
          const isHovered = hoverIndex === i
          return (
            <g key={pt.data.month}>
              {/* Invisible wide hit area for hover */}
              <rect
                x={pt.x - chartW / (data.length * 2)}
                y={0}
                width={chartW / data.length}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />

              {/* Point circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5.5 : 3}
                fill={isHovered ? '#ffffff' : color}
                stroke={color}
                strokeWidth={isHovered ? 3 : 1.5}
                className="transition-all duration-150"
              />

              {/* Month label along bottom */}
              <text
                x={pt.x}
                y={height - 8}
                textAnchor="middle"
                className={`text-[11px] font-semibold transition-colors ${
                  isHovered
                    ? 'fill-orange-500 font-bold'
                    : 'fill-slate-400 dark:fill-slate-500'
                }`}
              >
                {pt.data.shortMonth}
              </text>
            </g>
          )
        })}

        {/* Active dashed indicator cursor */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={paddingTop}
            x2={activePoint.x}
            y2={height - paddingBottom}
            stroke={color}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Floating Tooltip */}
      {activePoint && (
        <div
          className="absolute -top-3 pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2 whitespace-nowrap transition-transform"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
          }}
        >
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>{activePoint.data.month}:</span>
          <span className="font-mono font-bold tabular-nums">
            {activePoint.data.value.toLocaleString()} signups
          </span>
        </div>
      )}
    </div>
  )
}

export default ActivityAreaChart
