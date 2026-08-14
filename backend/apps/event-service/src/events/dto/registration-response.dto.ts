import { RegistrationStatus } from '../enums/registration-status.enum';

export class RegistrationResponseDto {
  id!: string;
  eventId!: string;
  userId!: string;
  status!: RegistrationStatus;
  registeredAt!: Date;
}
