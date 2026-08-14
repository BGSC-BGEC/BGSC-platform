import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SponsorStatus } from '../enums/sponsor-status.enum';

@Entity({ name: 'sponsors' })
export class Sponsor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120, unique: true })
  name!: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'website_url', type: 'text', nullable: true })
  websiteUrl?: string | null;

  @Column({ name: 'tenure_start', type: 'date' })
  tenureStart!: string;

  @Column({ name: 'tenure_end', type: 'date', nullable: true })
  tenureEnd?: string | null;

  @Column({ type: 'varchar', length: 50, default: SponsorStatus.ACTIVE })
  status!: SponsorStatus;

  @Column({ name: 'total_fans', type: 'integer', default: 0 })
  totalFans!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
