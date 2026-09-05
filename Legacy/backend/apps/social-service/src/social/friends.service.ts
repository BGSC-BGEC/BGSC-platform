import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { In, Or, Repository } from 'typeorm';
import {
  FriendshipResponseDto,
  FriendsListResponseDto,
} from './dto/friendship-response.dto';
import { SendFriendRequestDto } from './dto/friendship.dto';
import { Friendship } from './entities/friendship.entity';
import { FriendshipStatus } from './enums/friendship-status.enum';

const PRESENCE_TTL_SECONDS = 300;

@Injectable()
export class FriendsService {
  private readonly redis: Redis;

  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepo: Repository<Friendship>,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('social.redis.url')!;
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    this.redis.on('error', (err: Error) => {
      console.error(`[social-service] Redis error: ${err.message}`);
    });
  }

  async sendRequest(
    requesterId: string,
    dto: SendFriendRequestDto,
  ): Promise<FriendshipResponseDto> {
    if (requesterId === dto.recipientId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const existing = await this.findBetween(requesterId, dto.recipientId);
    if (existing) {
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new ForbiddenException('Cannot send request to blocked user');
      }
      throw new ConflictException('Friend relationship already exists');
    }

    const friendship = this.friendshipRepo.create({
      requesterId,
      recipientId: dto.recipientId,
      status: FriendshipStatus.PENDING,
    });
    try {
      return this.toResponse(await this.friendshipRepo.save(friendship));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Friend relationship already exists');
      }
      throw error;
    }
  }

  async getIncomingRequests(userId: string): Promise<FriendshipResponseDto[]> {
    const rows = await this.friendshipRepo.find({
      where: { recipientId: userId, status: FriendshipStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async getOutgoingRequests(userId: string): Promise<FriendshipResponseDto[]> {
    const rows = await this.friendshipRepo.find({
      where: { requesterId: userId, status: FriendshipStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async acceptRequest(
    requestId: string,
    userId: string,
  ): Promise<FriendshipResponseDto> {
    const friendship = await this.friendshipRepo.findOne({
      where: { id: requestId },
    });
    if (!friendship)
      throw new NotFoundException(`Friend request ${requestId} not found`);
    if (friendship.recipientId !== userId)
      throw new ForbiddenException('Not your request to accept');
    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Request is not in pending state');
    }

    friendship.status = FriendshipStatus.ACCEPTED;
    const saved = await this.friendshipRepo.save(friendship);
    return this.toResponse(saved);
  }

  async rejectRequest(
    requestId: string,
    userId: string,
  ): Promise<FriendshipResponseDto> {
    const friendship = await this.friendshipRepo.findOne({
      where: { id: requestId },
    });
    if (!friendship)
      throw new NotFoundException(`Friend request ${requestId} not found`);
    if (friendship.recipientId !== userId)
      throw new ForbiddenException('Not your request to reject');
    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Request is not in pending state');
    }

    friendship.status = FriendshipStatus.REJECTED;
    const saved = await this.friendshipRepo.save(friendship);
    return this.toResponse(saved);
  }

  async blockUser(
    userId: string,
    targetUserId: string,
  ): Promise<FriendshipResponseDto> {
    if (userId === targetUserId)
      throw new BadRequestException('Cannot block yourself');

    const existing = await this.findBetween(userId, targetUserId);
    if (existing) {
      existing.status = FriendshipStatus.BLOCKED;
      existing.requesterId = userId;
      existing.recipientId = targetUserId;
      const saved = await this.friendshipRepo.save(existing);
      return this.toResponse(saved);
    }

    const friendship = this.friendshipRepo.create({
      requesterId: userId,
      recipientId: targetUserId,
      status: FriendshipStatus.BLOCKED,
    });
    const saved = await this.friendshipRepo.save(friendship);
    return this.toResponse(saved);
  }

  async removeFriend(
    userId: string,
    targetUserId: string,
  ): Promise<{ removed: boolean }> {
    const friendship = await this.findBetween(userId, targetUserId);
    if (!friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
      throw new NotFoundException('Friendship not found');
    }
    await this.friendshipRepo.delete(friendship.id);
    return { removed: true };
  }

  async listFriends(
    userId: string,
    page: number,
    limit: number,
  ): Promise<FriendsListResponseDto> {
    const [rows, total] = await this.friendshipRepo.findAndCount({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { recipientId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { friends: rows.map((r) => this.toResponse(r)), total };
  }

  async getSuggestions(
    userId: string,
  ): Promise<{ userId: string; mutualCount: number }[]> {
    const friendIds = await this.getFriendIds(userId);
    if (friendIds.length === 0) return [];

    const secondDegree = await this.friendshipRepo.find({
      where: [
        { requesterId: In(friendIds), status: FriendshipStatus.ACCEPTED },
        { recipientId: In(friendIds), status: FriendshipStatus.ACCEPTED },
      ],
    });

    const mutualCounts: Record<string, number> = {};
    for (const f of secondDegree) {
      const other = friendIds.includes(f.requesterId)
        ? f.recipientId
        : f.requesterId;
      if (other === userId || friendIds.includes(other)) continue;
      mutualCounts[other] = (mutualCounts[other] ?? 0) + 1;
    }

    return Object.entries(mutualCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, count]) => ({ userId: id, mutualCount: count }));
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const rows = await this.friendshipRepo.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { recipientId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      select: ['requesterId', 'recipientId'],
    });
    return rows.map((r) =>
      r.requesterId === userId ? r.recipientId : r.requesterId,
    );
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.findBetween(userId1, userId2);
    return friendship?.status === FriendshipStatus.ACCEPTED;
  }

  async updatePresence(userId: string): Promise<void> {
    await this.redis.set(`presence:${userId}`, '1', 'EX', PRESENCE_TTL_SECONDS);
  }

  async getOnlineFriends(
    userId: string,
  ): Promise<{ userId: string; online: boolean }[]> {
    const friendIds = await this.getFriendIds(userId);
    if (friendIds.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of friendIds) {
      pipeline.exists(`presence:${id}`);
    }
    const results = await pipeline.exec();

    return friendIds.map((id, i) => ({
      userId: id,
      online: (results?.[i]?.[1] as number) === 1,
    }));
  }

  private async findBetween(a: string, b: string): Promise<Friendship | null> {
    return this.friendshipRepo.findOne({
      where: [
        { requesterId: a, recipientId: b },
        { requesterId: b, recipientId: a },
      ],
    });
  }

  private toResponse(f: Friendship): FriendshipResponseDto {
    return {
      id: f.id,
      requesterId: f.requesterId,
      recipientId: f.recipientId,
      status: f.status,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }
}
