import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../src/users/dto/create-user.dto';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { UsersService } from '../src/users/users.service';

type UsersRepositoryMock = Pick<
  jest.Mocked<Repository<User>>,
  'create' | 'find' | 'findOneBy' | 'save'
>;

describe('UsersService', () => {
  let repository: UsersRepositoryMock;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    service = new UsersService(repository as unknown as Repository<User>);
  });

  it('creates a user with default role and active status', async () => {
    const dto: CreateUserDto = {
      email: 'test@bits-goa.ac.in',
      username: 'testuser',
    };
    const user = makeUser(dto);

    repository.create.mockReturnValue(user);
    repository.save.mockResolvedValue(user);

    await expect(service.create(dto)).resolves.toMatchObject({
      email: dto.email,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      username: dto.username,
    });
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
  });

  it('returns users filtered by role and status', async () => {
    const user = makeUser({ role: UserRole.MEMBER, username: 'member1' });

    repository.find.mockResolvedValue([user]);

    await expect(
      service.findAll({ role: UserRole.MEMBER, status: UserStatus.ACTIVE }),
    ).resolves.toHaveLength(1);
    expect(repository.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      where: { role: UserRole.MEMBER, status: UserStatus.ACTIVE },
    });
  });

  it('throws not found for a missing user', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates an existing user', async () => {
    const user = makeUser({ username: 'oldname' });
    const updatedUser = makeUser({ ...user, username: 'newname' });

    repository.findOneBy
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(updatedUser);
    repository.save.mockResolvedValue(updatedUser);

    await expect(
      service.update(user.id, { username: 'newname' }),
    ).resolves.toMatchObject({ username: 'newname' });
  });

  it('soft deletes a user by changing status', async () => {
    const user = makeUser();
    const deletedUser = makeUser({ status: UserStatus.DELETED });

    repository.findOneBy
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(deletedUser);
    repository.save.mockResolvedValue(deletedUser);

    await expect(service.remove(user.id)).resolves.toMatchObject({
      status: UserStatus.DELETED,
    });
    expect(user.status).toBe(UserStatus.DELETED);
  });

  it('maps Postgres unique constraint errors to conflict errors', async () => {
    const dto: CreateUserDto = {
      email: 'dupe@bits-goa.ac.in',
      username: 'dupe',
    };

    repository.create.mockReturnValue(makeUser(dto));
    repository.save.mockRejectedValue({ code: '23505' });

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });
});

function makeUser(partial: Partial<User> = {}): User {
  return Object.assign(new User(), {
    activeSponsorId: null,
    avatarUrl: null,
    contact: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'user@bits-goa.ac.in',
    id: 'd07dd637-4f44-4e65-b10e-f8db25356f3c',
    interests: [],
    lastActive: null,
    newsletterSubscriptions: [],
    pointsBalance: 0,
    role: UserRole.USER,
    settings: {},
    socials: {},
    status: UserStatus.ACTIVE,
    steamId: null,
    stravaId: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    username: 'user1',
    ...partial,
  });
}
