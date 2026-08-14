import { PostVisibility } from '../enums/post-visibility.enum';

export class PostResponseDto {
  id!: string;
  userId!: string;
  caption?: string | null;
  mediaUrls!: string[];
  tags!: string[];
  visibility!: PostVisibility;
  likesEnabled!: boolean;
  commentsEnabled!: boolean;
  commentsVisibility!: PostVisibility;
  sharesAllowed!: boolean;
  createdAt!: Date;
  likeCount!: number;
  commentCount!: number;
  likedByMe!: boolean;
}

export class PostsListResponseDto {
  posts!: PostResponseDto[];
  total!: number;
  page!: number;
}

export class CommentResponseDto {
  id!: string;
  postId!: string;
  userId!: string;
  body!: string;
  createdAt!: Date;
}

export class CreateCommentDto {
  body!: string;
}
