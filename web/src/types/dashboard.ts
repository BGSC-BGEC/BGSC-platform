export interface StatItem {
    id: string
    label: string
    value: string | number
    change: string
    color?: string
}

export interface DashboardViewProps {
    stats?: StatItem[]
}