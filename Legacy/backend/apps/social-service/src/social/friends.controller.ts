import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendshipResponseDto, FriendsListResponseDto } from './dto/friendship-response.dto';
import { SendFriendRequestDto } from './dto/friendship.dto';
import { FriendsService } from './friends.service';

type AuthRequest = Request & { user: { id: string; role: string } };

@ApiTags('social/friends')
@ApiBearerAuth()
@Controller('social/friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'List accepted friends (paginated)' })
  listFriends(
    @Req() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<FriendsListResponseDto> {
    return this.friendsService.listFriends(
      req.user.id,
      Math.max(1, parseInt(page, 10)),
      Math.min(100, Math.max(1, parseInt(limit, 10))),
    );
  }

  @Post('requests')
  @ApiOperation({ summary: 'Send a friend request' })
  sendRequest(
    @Req() req: AuthRequest,
    @Body() dto: SendFriendRequestDto,
  ): Promise<FriendshipResponseDto> {
    return this.friendsService.sendRequest(req.user.id, dto);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'List incoming friend requests' })
  getIncoming(@Req() req: AuthRequest): Promise<FriendshipResponseDto[]> {
    return this.friendsService.getIncomingRequests(req.user.id);
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'List outgoing friend requests' })
  getOutgoing(@Req() req: AuthRequest): Promise<FriendshipResponseDto[]> {
    return this.friendsService.getOutgoingRequests(req.user.id);
  }

  @Patch('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  acceptRequest(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<FriendshipResponseDto> {
    return this.friendsService.acceptRequest(id, req.user.id);
  }

  @Patch('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a friend request' })
  rejectRequest(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<FriendshipResponseDto> {
    return this.friendsService.rejectRequest(id, req.user.id);
  }

  @Post(':userId/block')
  @ApiOperation({ summary: 'Block a user' })
  blockUser(
    @Param('userId') targetUserId: string,
    @Req() req: AuthRequest,
  ): Promise<FriendshipResponseDto> {
    return this.friendsService.blockUser(req.user.id, targetUserId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a friend' })
  removeFriend(
    @Param('userId') targetUserId: string,
    @Req() req: AuthRequest,
  ): Promise<{ removed: boolean }> {
    return this.friendsService.removeFriend(req.user.id, targetUserId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get friend suggestions based on mutual connections' })
  getSuggestions(
    @Req() req: AuthRequest,
  ): Promise<{ userId: string; mutualCount: number }[]> {
    return this.friendsService.getSuggestions(req.user.id);
  }

  @Post('presence')
  @ApiOperation({ summary: 'Update online presence (heartbeat, 5-min TTL)' })
  async updatePresence(@Req() req: AuthRequest): Promise<{ updated: boolean }> {
    await this.friendsService.updatePresence(req.user.id);
    return { updated: true };
  }

  @Get('online')
  @ApiOperation({ summary: 'Get online status of friends' })
  getOnlineFriends(
    @Req() req: AuthRequest,
  ): Promise<{ userId: string; online: boolean }[]> {
    return this.friendsService.getOnlineFriends(req.user.id);
  }
}
