import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PointsController } from '../src/points/points.controller';
import { PointsService } from '../src/points/points.service';

describe('PointsController internal attendance award', () => {
  const internalKey = 'test-internal-service-key-32-characters';
  const dto = {
    registrationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    eventId: '33333333-3333-4333-8333-333333333333',
  };
  const pointsService = {
    awardAttendance: jest.fn().mockResolvedValue({ id: 'transaction-id' }),
  };
  const controller = new PointsController(
    pointsService as unknown as PointsService,
    { get: jest.fn().mockReturnValue(internalKey) } as unknown as ConfigService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid internal key', () => {
    expect(() => controller.awardAttendance('wrong-key', dto)).toThrow(
      ForbiddenException,
    );
  });

  it('accepts the shared internal key', async () => {
    await controller.awardAttendance(internalKey, dto);

    expect(pointsService.awardAttendance).toHaveBeenCalledWith(
      dto.registrationId,
      dto.userId,
      dto.eventId,
    );
  });
});
