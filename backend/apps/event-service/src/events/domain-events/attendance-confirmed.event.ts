export interface AttendanceConfirmedEvent {
  registrationId: string;
  eventId: string;
  userId: string;
  attendedAt: string;
}
