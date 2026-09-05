import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChallengeDifficulty, ChallengeStatus } from '../enums/challenge.enum';

@Entity({ name: 'challenges' })
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 50 })
  domain!: string;

  @Column({ name: 'team_limit', type: 'integer', default: 1 })
  teamLimit!: number;

  @Column({ name: 'time_limit', type: 'integer', nullable: true })
  timeLimit?: number | null;

  @Column({ name: 'resource_links', type: 'text', array: true, default: '{}' })
  resourceLinks!: string[];

  @Column({ name: 'award_points', type: 'integer' })
  awardPoints!: number;

  @Column({ type: 'varchar', length: 20 })
  difficulty!: ChallengeDifficulty;

  @Column({ type: 'varchar', length: 20, default: ChallengeStatus.ACTIVE })
  status!: ChallengeStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
