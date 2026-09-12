import type { StatItem } from '../types/dashboard'

export const DEFAULT_DASHBOARD_STATS: StatItem[] = [
    {
    id: 'members',
    label: 'Total Members',
    value: '1,248',
    change: '+12% this month',
    color: 'text-black',
    },
    {
    id: 'events',
    label: 'Active Events',
    value: '4',
    change: '2 closing soon',
    color: 'text-black',
    },
    {
    id: 'tournaments',
    label: 'Tournaments',
    value: '3',
    change: 'Offside S3 Live',
    color: 'text-black',
    },
    {
    id: 'points',
    label: 'Points Issued',
    value: '84,200',
    change: '+3,400 this week',
    color: 'text-black',
    },
]