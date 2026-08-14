export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPoints(points: number): string {
  return `${formatNumber(points)} pts`;
}

export function formatDeviation(percent: number): { text: string; level: 'neutral' | 'warning' | 'critical'; classNames: string } {
  const isPositive = percent > 0;
  const sign = isPositive ? '+' : '';
  const text = `${sign}${percent}% ${percent > 25 ? 'High Dev!' : percent > 10 ? 'deviation' : ''}`.trim();
  
  if (percent > 25) {
    return {
      text,
      level: 'critical',
      classNames: 'bg-red-500/20 text-red-400 border border-red-500/30',
    };
  }
  if (percent > 10) {
    return {
      text,
      level: 'warning',
      classNames: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    };
  }
  return {
    text: percent === 0 ? '0% deviation' : `${sign}${percent}%`,
    level: 'neutral',
    classNames: 'bg-slate-700 text-slate-300 border border-slate-600',
  };
}
