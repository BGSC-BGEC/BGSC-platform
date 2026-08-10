import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FriendshipStatus } from '../enums/friendship-status.enum';

@Entity({ name: 'friendships' })
@Index(['requesterId', 'recipientId'], { unique: true })
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @Column({ type: 'varchar', length: 20, default: FriendshipStatus.PENDING })
  status!: FriendshipStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
