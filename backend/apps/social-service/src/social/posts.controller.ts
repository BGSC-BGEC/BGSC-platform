import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import {
  CommentResponseDto,
  PostResponseDto,
  PostsListResponseDto,
} from './dto/post-response.dto';
import { PostsService } from './posts.service';

type AuthRequest = Request & { user: { id: string; role: string } };

@ApiTags('social/posts')
@Controller('social/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a post' })
  createPost(@Req() req: AuthRequest, @Body() dto: CreatePostDto): Promise<PostResponseDto> {
    return this.postsService.createPost(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID' })
  getPost(@Param('id') id: string, @Req() req: Request & { user?: { id: string } }): Promise<PostResponseDto> {
    return this.postsService.getPost(id, req.user?.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a post' })
  deletePost(@Param('id') id: string, @Req() req: AuthRequest): Promise<PostResponseDto> {
    return this.postsService.deletePost(id, req.user.id);
  }

  @Post(':id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Like a post' })
  likePost(@Param('id') id: string, @Req() req: AuthRequest): Promise<{ liked: boolean }> {
    return this.postsService.likePost(id, req.user.id);
  }

  @Delete(':id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unlike a post' })
  unlikePost(@Param('id') id: string, @Req() req: AuthRequest): Promise<{ liked: boolean }> {
    return this.postsService.unlikePost(id, req.user.id);
  }

  @Post(':id/comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a comment to a post' })
  addComment(
    @Param('id') postId: string,
    @Req() req: AuthRequest,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.postsService.addComment(postId, req.user.id, dto);
  }

  @Get(':id/comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get comments on a post' })
  getComments(
    @Param('id') postId: string,
    @Req() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<CommentResponseDto[]> {
    return this.postsService.getComments(
      postId,
      req.user.id,
      Math.max(1, parseInt(page, 10)),
      Math.min(100, Math.max(1, parseInt(limit, 10))),
    );
  }

  @Delete(':postId/comments/:commentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Req() req: AuthRequest,
  ): Promise<CommentResponseDto> {
    return this.postsService.deleteComment(postId, commentId, req.user.id);
  }
}

@ApiTags('social/feed')
@Controller('social/feed')
export class FeedController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get personalized feed (friends + public posts)' })
  getFeed(
    @Req() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<PostsListResponseDto> {
    return this.postsService.getFeed(
      req.user.id,
      Math.max(1, parseInt(page, 10)),
      Math.min(50, Math.max(1, parseInt(limit, 10))),
    );
  }

  @Get('public')
  @ApiOperation({ summary: 'Get public feed (no auth required)' })
  getPublicFeed(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<PostsListResponseDto> {
    return this.postsService.getPublicFeed(
      Math.max(1, parseInt(page, 10)),
      Math.min(50, Math.max(1, parseInt(limit, 10))),
    );
  }
}
