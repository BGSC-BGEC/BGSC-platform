export class NotificationResponseDto {
  id!: string;
  userId!: string;
  type!: string;
  title!: string;
  body!: string;
  isRead!: boolean;
  referenceId?: string | null;
  referenceType?: string | null;
  createdAt!: Date;
}
