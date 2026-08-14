import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CommentResponseDto,
  PostResponseDto,
  PostsListResponseDto,
} from './dto/post-response.dto';
import { PostComment } from './entities/post-comment.entity';
import { PostLike } from './entities/post-like.entity';
import { Post } from './entities/post.entity';
import { PostVisibility } from './enums/post-visibility.enum';
import { FriendsService } from './friends.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly likeRepo: Repository<PostLike>,
    @InjectRepository(PostComment)
    private readonly commentRepo: Repository<PostComment>,
    private readonly friendsService: FriendsService,
  ) {}

  async createPost(userId: string, dto: CreatePostDto): Promise<PostResponseDto> {
    const post = this.postRepo.create({
      userId,
      caption: dto.caption ?? null,
      mediaUrls: dto.mediaUrls ?? [],
      tags: dto.tags ?? [],
      visibility: dto.visibility ?? PostVisibility.PUBLIC,
      likesEnabled: dto.likesEnabled ?? true,
      commentsEnabled: dto.commentsEnabled ?? true,
      commentsVisibility: dto.commentsVisibility ?? PostVisibility.PUBLIC,
      sharesAllowed: dto.sharesAllowed ?? true,
    });
    const saved = await this.postRepo.save(post);
    return this.toPostResponse(saved, 0, 0, false);
  }

  async getPost(postId: string, viewerUserId?: string): Promise<PostResponseDto> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);

    if (viewerUserId) {
      await this.assertCanView(post, viewerUserId);
    } else if (post.visibility !== PostVisibility.PUBLIC) {
      throw new ForbiddenException('This post is not public');
    }

    const [likeCount, commentCount, likedByMe] = await Promise.all([
      this.likeRepo.count({ where: { postId } }),
      this.commentRepo.count({ where: { postId } }),
      viewerUserId
        ? this.likeRepo.findOne({ where: { postId, userId: viewerUserId } }).then(Boolean)
        : Promise.resolve(false),
    ]);

    return this.toPostResponse(post, likeCount, commentCount, likedByMe);
  }

  async deletePost(postId: string, userId: string): Promise<PostResponseDto> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    if (post.userId !== userId) throw new ForbiddenException('Not your post');

    const [likeCount, commentCount] = await Promise.all([
      this.likeRepo.count({ where: { postId } }),
      this.commentRepo.count({ where: { postId } }),
    ]);

    await this.postRepo.delete(postId);
    return this.toPostResponse(post, likeCount, commentCount, false);
  }

  async likePost(postId: string, userId: string): Promise<{ liked: boolean }> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    if (!post.likesEnabled) throw new ForbiddenException('Likes are disabled for this post');

    await this.assertCanView(post, userId);

    const existing = await this.likeRepo.findOne({ where: { postId, userId } });
    if (existing) throw new ConflictException('Already liked this post');

    await this.likeRepo.save(this.likeRepo.create({ postId, userId }));
    return { liked: true };
  }

  async unlikePost(postId: string, userId: string): Promise<{ liked: boolean }> {
    const existing = await this.likeRepo.findOne({ where: { postId, userId } });
    if (!existing) throw new NotFoundException('Like not found');
    await this.likeRepo.delete(existing.id);
    return { liked: false };
  }

  async addComment(postId: string, userId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    if (!post.commentsEnabled) throw new ForbiddenException('Comments are disabled for this post');

    await this.assertCanView(post, userId);

    const comment = this.commentRepo.create({ postId, userId, body: dto.body });
    const saved = await this.commentRepo.save(comment);
    return this.toCommentResponse(saved);
  }

  async getComments(postId: string, viewerUserId: string, page: number, limit: number): Promise<CommentResponseDto[]> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);

    await this.assertCanView(post, viewerUserId);

    const comments = await this.commentRepo.find({
      where: { postId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return comments.map((c) => this.toCommentResponse(c));
  }

  async deleteComment(postId: string, commentId: string, userId: string): Promise<CommentResponseDto> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId, postId } });
    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

    const post = await this.postRepo.findOne({ where: { id: postId } });
    const isOwner = comment.userId === userId;
    const isPostOwner = post?.userId === userId;
    if (!isOwner && !isPostOwner) throw new ForbiddenException('Cannot delete this comment');

    await this.commentRepo.delete(commentId);
    return this.toCommentResponse(comment);
  }

  async getFeed(userId: string, page: number, limit: number): Promise<PostsListResponseDto> {
    const friendIds = await this.friendsService.getFriendIds(userId);

    const qb = this.postRepo
      .createQueryBuilder('p')
      .where(
        `(p.user_id = :userId) OR
         (p.user_id IN (:...friendIds) AND p.visibility IN (:...allVis)) OR
         (p.visibility = :public AND p.user_id NOT IN (:...friendIds))`,
        {
          userId,
          friendIds: friendIds.length > 0 ? friendIds : ['__none__'],
          allVis: [PostVisibility.PUBLIC, PostVisibility.PROTECTED, PostVisibility.PRIVATE],
          public: PostVisibility.PUBLIC,
        },
      )
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();

    const postIds = posts.map((p) => p.id);
    const [likeCounts, commentCounts, myLikes] = await Promise.all([
      postIds.length > 0
        ? this.likeRepo
            .createQueryBuilder('l')
            .select('l.post_id', 'postId')
            .addSelect('COUNT(*)', 'count')
            .where('l.post_id IN (:...postIds)', { postIds })
            .groupBy('l.post_id')
            .getRawMany<{ postId: string; count: string }>()
        : Promise.resolve([]),
      postIds.length > 0
        ? this.commentRepo
            .createQueryBuilder('c')
            .select('c.post_id', 'postId')
            .addSelect('COUNT(*)', 'count')
            .where('c.post_id IN (:...postIds)', { postIds })
            .groupBy('c.post_id')
            .getRawMany<{ postId: string; count: string }>()
        : Promise.resolve([]),
      postIds.length > 0
        ? this.likeRepo.find({ where: { postId: In(postIds), userId } })
        : Promise.resolve([]),
    ]);

    const likeMap = Object.fromEntries(likeCounts.map((r) => [r.postId, Number(r.count)]));
    const commentMap = Object.fromEntries(commentCounts.map((r) => [r.postId, Number(r.count)]));
    const likedSet = new Set(myLikes.map((l) => l.postId));

    return {
      posts: posts.map((p) =>
        this.toPostResponse(p, likeMap[p.id] ?? 0, commentMap[p.id] ?? 0, likedSet.has(p.id)),
      ),
      total,
      page,
    };
  }

  async getPublicFeed(page: number, limit: number): Promise<PostsListResponseDto> {
    const [posts, total] = await this.postRepo.findAndCount({
      where: { visibility: PostVisibility.PUBLIC },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const postIds = posts.map((p) => p.id);
    const [likeCounts, commentCounts] = postIds.length > 0
      ? await Promise.all([
          this.likeRepo
            .createQueryBuilder('l')
            .select('l.post_id', 'postId')
            .addSelect('COUNT(*)', 'count')
            .where('l.post_id IN (:...postIds)', { postIds })
            .groupBy('l.post_id')
            .getRawMany<{ postId: string; count: string }>(),
          this.commentRepo
            .createQueryBuilder('c')
            .select('c.post_id', 'postId')
            .addSelect('COUNT(*)', 'count')
            .where('c.post_id IN (:...postIds)', { postIds })
            .groupBy('c.post_id')
            .getRawMany<{ postId: string; count: string }>(),
        ])
      : [[], []];

    const likeMap = Object.fromEntries(likeCounts.map((r) => [r.postId, Number(r.count)]));
    const commentMap = Object.fromEntries(commentCounts.map((r) => [r.postId, Number(r.count)]));

    return {
      posts: posts.map((p) => this.toPostResponse(p, likeMap[p.id] ?? 0, commentMap[p.id] ?? 0, false)),
      total,
      page,
    };
  }

  private async assertCanView(post: Post, viewerUserId: string): Promise<void> {
    if (post.visibility === PostVisibility.PUBLIC) return;
    if (post.userId === viewerUserId) return;
    if (post.visibility === PostVisibility.PROTECTED) return;
    // PRIVATE: only friends can see
    const friends = await this.friendsService.areFriends(post.userId, viewerUserId);
    if (!friends) throw new ForbiddenException('This post is private');
  }

  private toPostResponse(post: Post, likeCount: number, commentCount: number, likedByMe: boolean): PostResponseDto {
    return {
      id: post.id,
      userId: post.userId,
      caption: post.caption,
      mediaUrls: post.mediaUrls,
      tags: post.tags,
      visibility: post.visibility,
      likesEnabled: post.likesEnabled,
      commentsEnabled: post.commentsEnabled,
      commentsVisibility: post.commentsVisibility,
      sharesAllowed: post.sharesAllowed,
      createdAt: post.createdAt,
      likeCount,
      commentCount,
      likedByMe,
    };
  }

  private toCommentResponse(c: PostComment): CommentResponseDto {
    return { id: c.id, postId: c.postId, userId: c.userId, body: c.body, createdAt: c.createdAt };
  }
}
