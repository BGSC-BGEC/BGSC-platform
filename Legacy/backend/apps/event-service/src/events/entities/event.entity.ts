import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 10 })
  type!: EventType;

  @Column({ type: 'varchar', length: 20, default: EventStatus.UPCOMING })
  status!: EventStatus;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate!: Date;

  @Column({ name: 'registration_deadline', type: 'timestamptz' })
  registrationDeadline!: Date;

  @Column({ type: 'varchar', nullable: true, length: 200 })
  venue?: string | null;

  @Column({ name: 'rules_pdf_url', type: 'text', nullable: true })
  rulesPdfUrl?: string | null;

  @Column({ name: 'max_participants', type: 'integer', nullable: true })
  maxParticipants?: number | null;

  @Column({ name: 'needs_leaderboard', type: 'boolean', default: false })
  needsLeaderboard!: boolean;

  @Column({ name: 'tags', type: 'text', array: true, default: [] })
  tags!: string[];

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
