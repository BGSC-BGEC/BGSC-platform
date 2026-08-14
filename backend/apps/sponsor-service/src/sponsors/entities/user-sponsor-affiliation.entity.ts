import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_sponsor_affiliations' })
@Index(['userId'])
@Index(['sponsorId'])
@Index(['userId', 'sponsorId'], { unique: true })
export class UserSponsorAffiliation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'sponsor_id', type: 'uuid' })
  sponsorId!: string;

  @Column({
    name: 'affiliated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  affiliatedAt!: Date;

  @Column({ name: 'fan_count', type: 'integer', default: 0 })
  fanCount!: number;

  @Column({
    name: 'events_won',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  eventsWon!: string[];

  @Column({ name: 'total_points_contributed', type: 'integer', default: 0 })
  totalPointsContributed!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
