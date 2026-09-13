import type { MockEvent } from '../types/event';

export const MOCK_EVENTS: MockEvent[] = [
  {
    id: 'football-championship',
    title: 'Football Championship',
    category: 'Football',
    status: 'Open',
    dateLabel: 'Saturday, 10:00 AM',
    location: 'Main ground',
    description: 'Bring your team for the season opener. Matches are played in a league format with a knockout final.',
    capacityLabel: '16 teams maximum',
    deadlineLabel: 'Registration closes Friday midnight',
    tags: ['League', 'Team event'],
    registrationMode: 'team',
    hasPositions: true,
  },
  {
    id: 'bgec-esports',
    title: 'BGEC Esports Championship',
    category: 'Esports',
    status: 'Soon',
    dateLabel: 'Next Wednesday, 6:00 PM',
    location: 'Student activity centre',
    description: 'A campus Valorant tournament with group stages and a live knockout final.',
    capacityLabel: '32 players maximum',
    deadlineLabel: 'Registration opens Monday',
    tags: ['Valorant', 'Solo registration'],
    registrationMode: 'individual',
  },
  {
    id: 'bgsc-cricket-auction',
    title: 'BGSC Cricket League',
    category: 'Cricket',
    status: 'Open',
    dateLabel: 'Saturday, 8:00 AM',
    location: 'Cricket ground',
    description: 'Register as a player or apply to captain a team. Approved captains will draft players during the live auction.',
    capacityLabel: '48 players maximum',
    deadlineLabel: 'Player registration closes Thursday',
    tags: ['Player auction', 'Captain draft'],
    registrationMode: 'individual',
    hasAuction: true,
    auctionRegistration: 'player',
  },
  {
    id: 'campus-run',
    title: 'BGSC Campus Run',
    category: 'Fitness',
    status: 'Open',
    dateLabel: 'Sunday, 7:00 AM',
    location: 'East gate assembly point',
    description: 'A relaxed 5K campus run for members of every fitness level.',
    capacityLabel: '100 runners maximum',
    deadlineLabel: 'Registration closes Saturday',
    tags: ['5K', 'Individual event'],
    registrationMode: 'individual',
  },
  {
    id: 'community-meetup',
    title: 'BGSC Community Meetup',
    category: 'Community',
    status: 'Full',
    dateLabel: 'Friday, 5:30 PM',
    location: 'Common room',
    description: 'Meet other members, share ideas, and help shape the next BGSC season.',
    capacityLabel: '40 members maximum',
    deadlineLabel: 'Waiting list available',
    tags: ['Networking', 'Members only'],
    registrationMode: 'individual',
  },
];

export const MOCK_TEAMS = [
  { id: 'north-stars', name: 'North Stars', eventId: 'football-championship' },
  { id: 'campus-united', name: 'Campus United', eventId: 'football-championship' },
  { id: 'orange-eleven', name: 'Orange Eleven', eventId: 'football-championship' },
];

const submittedEventIds = new Set<string>();
const mockRegistrationDetails = new Map<string, { role: 'member' | 'captain'; teamName?: string }>();

export function getMockEvent(eventId?: string) {
  return MOCK_EVENTS.find((event) => event.id === eventId) ?? MOCK_EVENTS[0];
}

export function hasMockRegistration(eventId: string) {
  return submittedEventIds.has(eventId);
}

export function submitMockRegistration(
  eventId: string,
  details?: { role: 'member' | 'captain'; teamName?: string },
) {
  submittedEventIds.add(eventId);
  if (details) mockRegistrationDetails.set(eventId, details);
}