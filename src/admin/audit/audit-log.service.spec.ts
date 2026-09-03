import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: { create: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };

  function mockQueryBuilder(result: any) {
    return {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue(result),
    };
  }

  beforeEach(async () => {
    repo = {
      create: jest.fn((e) => e),
      save: jest.fn((e) => Promise.resolve(e)),
      createQueryBuilder: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  it('records an audit entry', async () => {
    await service.record({
      adminId: 'admin-1',
      adminEmail: 'admin@example.com',
      action: 'STORY_DELETE',
      targetType: 'story',
      targetId: 'story-1',
      ip: '127.0.0.1',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-1',
        action: 'STORY_DELETE',
        targetId: 'story-1',
      }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('does not throw when persistence fails', async () => {
    repo.save.mockRejectedValue(new Error('db down'));
    await expect(
      service.record({ adminId: 'a', action: 'X' }),
    ).resolves.toBeUndefined();
  });

  it('lists audit entries with pagination', async () => {
    repo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([[{ id: 'log-1' }], 1]),
    );
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });
});
