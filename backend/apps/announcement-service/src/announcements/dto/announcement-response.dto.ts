export class AnnouncementResponseDto {
  id!: string;
  title!: string;
  body!: string;
  type!: string;
  tags!: string[];
  createdBy!: string;
  whatsappSent!: boolean;
  expiresAt!: Date;
  createdAt!: Date;
}
