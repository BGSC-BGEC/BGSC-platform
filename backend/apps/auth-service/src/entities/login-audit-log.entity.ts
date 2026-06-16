import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('login_audit_log')
export class LoginAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 }) // To handle both IPv4 and IPv6
  ipAddress!: string;

  @Column({ name: 'user_agent', type: 'text' })
  userAgent!: string;

  @Column({ length: 20 })
  method!: string; // 'local', 'google', 'refresh'

  @Column()
  success!: boolean;

  @Column({ name: 'failure_reason', length: 100, nullable: true })
  failureReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
