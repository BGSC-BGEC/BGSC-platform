import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FriendsService } from './friends.service';
import { Friendship } from './entities/friendship.entity';

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({ on: jest.fn() })),
);

describe('FriendsService', () => {
  it('turns a racing reciprocal insert into a conflict', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockRejectedValue({ code: '23505' }),
    } as unknown as Repository<Friendship>;
    const service = new FriendsService(repo, {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as never);

    await expect(
      service.sendRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        recipientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
