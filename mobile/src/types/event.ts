export type EventCategory = 'Football' | 'Cricket' | 'Esports' | 'Fitness' | 'Community';
export type EventStatus = 'Open' | 'Soon' | 'Full' | 'Completed';
export type RegistrationMode = 'team' | 'individual';

export interface MockEvent {
  id: string;
  title: string;
  category: EventCategory;
  status: EventStatus;
  dateLabel: string;
  location: string;
  description: string;
  capacityLabel: string;
  deadlineLabel: string;
  tags: string[];
  registrationMode: RegistrationMode;
  hasPositions?: boolean;
  hasAuction?: boolean;
  auctionRegistration?: 'player' | 'captain';
}