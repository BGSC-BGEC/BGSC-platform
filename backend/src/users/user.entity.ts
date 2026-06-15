import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50, unique: true })
  username!: string;

  @Column({ length: 320, unique: true })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'text',
    nullable: true,
    select: false,
  })
  passwordHash?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contact?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  interests!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  socials!: Record<string, string>;

  @Column({ name: 'strava_id', type: 'varchar', nullable: true })
  stravaId?: string | null;

  @Column({ name: 'steam_id', type: 'varchar', nullable: true })
  steamId?: string | null;

  @Column({ name: 'points_balance', type: 'integer', default: 0 })
  pointsBalance!: number;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings!: Record<string, unknown>;

  @Column({
    name: 'newsletter_subscriptions',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  newsletterSubscriptions!: string[];

  @Column({ name: 'active_sponsor_id', type: 'uuid', nullable: true })
  activeSponsorId?: string | null;

  @Column({ name: 'last_active', type: 'timestamptz', nullable: true })
  lastActive?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
