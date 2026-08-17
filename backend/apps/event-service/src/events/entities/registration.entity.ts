import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RegistrationStatus } from '../enums/registration-status.enum';

@Entity({ name: 'registrations' })
@Index(['eventId', 'userId'], { unique: true })
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: RegistrationStatus.CONFIRMED,
  })
  status!: RegistrationStatus;

  @CreateDateColumn({ name: 'registered_at', type: 'timestamptz' })
  registeredAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'attended_at', type: 'timestamptz', nullable: true })
  attendedAt?: Date | null;

  @Column({ name: 'points_awarded_at', type: 'timestamptz', nullable: true })
  pointsAwardedAt?: Date | null;
}
