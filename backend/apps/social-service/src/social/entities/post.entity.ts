import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PostVisibility } from '../enums/post-visibility.enum';

@Entity({ name: 'posts' })
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  caption?: string | null;

  @Column({ name: 'media_urls', type: 'text', array: true, default: '{}' })
  mediaUrls!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  tags!: string[];

  @Column({ type: 'varchar', length: 20, default: PostVisibility.PUBLIC })
  visibility!: PostVisibility;

  @Column({ name: 'likes_enabled', type: 'boolean', default: true })
  likesEnabled!: boolean;

  @Column({ name: 'comments_enabled', type: 'boolean', default: true })
  commentsEnabled!: boolean;

  @Column({ name: 'comments_visibility', type: 'varchar', length: 20, default: PostVisibility.PUBLIC })
  commentsVisibility!: PostVisibility;

  @Column({ name: 'shares_allowed', type: 'boolean', default: true })
  sharesAllowed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
