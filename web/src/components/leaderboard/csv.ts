/** Client-side CSV download: no dependency, no server round trip. */

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // Spreadsheet formula injection: a cell starting with = + - @ is executed by Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s) && typeof value !== 'number') s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','))
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function csvSafeName(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export'
}
