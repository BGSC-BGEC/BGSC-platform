import { SponsorStatus } from '../enums/sponsor-status.enum';

export class SponsorResponseDto {
  id!: string;
  name!: string;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  tenureStart!: string;
  tenureEnd?: string | null;
  status!: SponsorStatus;
  totalFans!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
