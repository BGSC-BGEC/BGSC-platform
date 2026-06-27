export type AnnouncementTag =
  | 'BGEC'
  | 'FitSoc'
  | 'Airball'
  | 'Offside'
  | 'PowerPlay'
  | 'Around The Net'
  | 'Deuce'
  | 'Highlight Events'
  | 'Teams';

export const ALL_ANNOUNCEMENT_TAGS: AnnouncementTag[] = [
  'BGEC',
  'FitSoc',
  'Airball',
  'Offside',
  'PowerPlay',
  'Around The Net',
  'Deuce',
  'Highlight Events',
  'Teams',
];

export const TAG_COLORS: Record<AnnouncementTag, string> = {
  BGEC: '#3b82f6',
  FitSoc: '#22c55e',
  Airball: '#f59e0b',
  Offside: '#ef4444',
  PowerPlay: '#8b5cf6',
  'Around The Net': '#06b6d4',
  Deuce: '#f97316',
  'Highlight Events': '#ec4899',
  Teams: '#14b8a6',
};

export interface Coordinator {
  id: string;
  name: string;
  role: string;
  avatarInitial: string;
  avatarColor: string;
  latestAnnouncement?: {
    id: string;
    body: string;
  };
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tags: AnnouncementTag[];
  author: {
    id: string;
    name: string;
    role: string;
    avatarInitial: string;
    avatarColor: string;
  };
  createdAt: string;
}

export interface Post {
  id: string;
  author: {
    id: string;
    displayName: string;
    username: string;
    avatarInitial: string;
    avatarColor: string;
  };
  media: Array<{ type: 'image' | 'video'; uri: string }>;
  caption?: string;
  tags: string[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
  createdAt: string;
  sharingEnabled: boolean;
  commentsEnabled: boolean;
  commentVisibility: 'public' | 'private' | 'protected';
}

export interface Reply {
  id: string;
  author: {
    id: string;
    displayName: string;
    avatarInitial: string;
    avatarColor: string;
  };
  body: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  author: {
    id: string;
    displayName: string;
    avatarInitial: string;
    avatarColor: string;
  };
  body: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  replies: Reply[];
}

export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
