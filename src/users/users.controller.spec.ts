import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: { [K in keyof UsersService]: jest.Mock };

  beforeEach(async () => {
    const usersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      getStats: jest.fn(),
      getStoryLibrary: jest.fn(),
      getSharedStories: jest.fn(),
      getPublicProfile: jest.fn(),
      getPublicStories: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
  });

  it('getProfile wraps response in success envelope', async () => {
    service.getProfile.mockResolvedValue({ id: 'u-1' });
    const result = await controller.getProfile('u-1');
    expect(result).toEqual({ success: true, data: { id: 'u-1' } });
    expect(service.getProfile).toHaveBeenCalledWith('u-1');
  });

  it('updateProfile returns the updated profile', async () => {
    service.updateProfile.mockResolvedValue({ id: 'u-1', firstName: 'Omar' });
    const dto = { firstName: 'Omar' };
    const result = await controller.updateProfile('u-1', dto);
    expect(result).toEqual({
      success: true,
      data: { id: 'u-1', firstName: 'Omar' },
    });
    expect(service.updateProfile).toHaveBeenCalledWith('u-1', dto);
  });

  it('uploadAvatar returns the uploaded avatar data', async () => {
    service.updateAvatar.mockResolvedValue({ avatarUrl: 'https://cdn/a.jpg' });
    const file = { buffer: Buffer.from('x') } as any;
    const result = await controller.uploadAvatar('u-1', file);
    expect(result).toEqual({
      success: true,
      data: { avatarUrl: 'https://cdn/a.jpg' },
    });
    expect(service.updateAvatar).toHaveBeenCalledWith('u-1', file);
  });

  it('getStats wraps stats in success envelope', async () => {
    service.getStats.mockResolvedValue({ totalStories: 12 });
    const result = await controller.getStats('u-1');
    expect(result).toEqual({ success: true, data: { totalStories: 12 } });
  });

  it('getStories merges pagination meta into the response', async () => {
    service.getStoryLibrary.mockResolvedValue({
      data: [{ id: 's-1' }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const query = { page: 1, limit: 10 };
    const result = await controller.getStories('u-1', query as any);
    expect(result).toEqual({
      success: true,
      data: [{ id: 's-1' }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('getSharedStories merges pagination meta', async () => {
    service.getSharedStories.mockResolvedValue({
      data: [],
      meta: { total: 4 },
    });
    const result = await controller.getSharedStories('u-1', {
      page: 1,
      limit: 12,
    } as any);
    expect(result).toEqual({ success: true, data: [], meta: { total: 4 } });
  });

  it('getPublicProfile returns a public author profile', async () => {
    service.getPublicProfile.mockResolvedValue({ id: 'u-1', name: 'Ahmed' });
    const result = await controller.getPublicProfile({
      userId: 'u-1',
    });
    expect(result).toEqual({
      success: true,
      data: { id: 'u-1', name: 'Ahmed' },
    });
    expect(service.getPublicProfile).toHaveBeenCalledWith('u-1');
  });

  it('getPublicStories returns public stories for an author', async () => {
    service.getPublicStories.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });
    const result = await controller.getPublicStories({ userId: 'u-1' }, {
      page: 1,
      limit: 12,
    } as any);
    expect(result).toEqual({ success: true, data: [], meta: { total: 0 } });
    expect(service.getPublicStories).toHaveBeenCalledWith('u-1', {
      page: 1,
      limit: 12,
    });
  });
});
