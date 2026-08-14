import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'strava_credentials' })
export class StravaCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'athlete_id', type: 'varchar', length: 30 })
  athleteId!: string;

  // AES-256-GCM encrypted: "iv_hex:auth_tag_hex:ciphertext_hex"
  @Column({ name: 'access_token_enc', type: 'text' })
  accessTokenEnc!: string;

  @Column({ name: 'refresh_token_enc', type: 'text' })
  refreshTokenEnc!: string;

  @Column({ name: 'expires_at', type: 'bigint' })
  expiresAt!: string;

  @Column({ name: 'scope', type: 'varchar', length: 255 })
  scope!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
