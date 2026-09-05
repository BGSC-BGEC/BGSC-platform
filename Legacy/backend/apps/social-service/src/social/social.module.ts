import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friendship } from './entities/friendship.entity';
import { Post } from './entities/post.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostLike } from './entities/post-like.entity';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FeedController, PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { RolesGuard } from '../rbac/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship, Post, PostLike, PostComment])],
  controllers: [FriendsController, PostsController, FeedController],
  providers: [FriendsService, PostsService, RolesGuard],
})
export class SocialModule {}
