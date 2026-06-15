import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole, UserStatus } from '../constants/roles.constant';

@Entity('users')
export class UserCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true, length: 255 })
  passwordHash?: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({ name: 'google_id', type: 'varchar', unique: true, nullable: true, length: 255 })
  googleId?: string | null;

  @Column({ name: 'totp_secret_enc', type: 'varchar', nullable: true, length: 512 })
  totpSecretEnc?: string | null;

  @Column({ name: 'totp_enabled', default: false })
  totpEnabled!: boolean;

  @Column({ name: 'password_reset_token_hash', type: 'varchar', nullable: true, length: 255 })
  passwordResetTokenHash?: string | null;

  @Column({ name: 'password_reset_expires', nullable: true, type: 'timestamptz' })
  passwordResetExpires?: Date | null;

  @Column({ name: 'disabled_at', nullable: true, type: 'timestamptz' })
  disabledAt?: Date | null;

  @Column({ name: 'disabled_by', nullable: true, type: 'uuid' })
  disabledBy?: string | null;

  @Column({ name: 'deletion_scheduled', nullable: true, type: 'timestamptz' })
  deletionScheduled?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
