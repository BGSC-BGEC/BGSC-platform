import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SubmissionStatus } from '../enums/challenge.enum';

@Entity({ name: 'challenge_submissions' })
export class ChallengeSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'challenge_id', type: 'uuid' })
  challengeId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'proof_url', type: 'text', nullable: true })
  proofUrl?: string | null;

  @Column({ name: 'proof_text', type: 'text', nullable: true })
  proofText?: string | null;

  @Column({ type: 'varchar', length: 20, default: SubmissionStatus.PENDING })
  status!: SubmissionStatus;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId?: string | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string | null;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @UpdateDateColumn({ name: 'reviewed_at', type: 'timestamptz' })
  reviewedAt!: Date;
}
