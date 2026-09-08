import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { StoryGenre } from '../../database/entities/story-genre.entity';
import { StoryEraOption } from '../../database/entities/story-era.entity';
import { StoryCivilizationOption } from '../../database/entities/story-civilization.entity';
import { StoryOptionsService } from './story-options.service';
import { AuditLogService } from '../../admin/audit/audit-log.service';

describe('StoryOptionsService', () => {
  let service: StoryOptionsService;
  let genreRepo: any;
  let eraRepo: any;
  let civilizationRepo: any;
  let auditService: any;

  const genre = {
    id: 'genre-1',
    name: 'Fantasy',
    description: null,
    isActive: true,
    legacyValue: 'FANTASY',
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const era = {
    id: 'era-1',
    name: 'Common Era',
    description: null,
    isActive: true,
    legacyValue: 'CE',
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const civilization = {
    id: 'civ-1',
    name: 'Ancient Egyptian',
    description: null,
    isActive: true,
    legacyValue: 'ANCIENT_EGYPTIAN',
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    genreRepo = {
      find: jest.fn().mockResolvedValue([genre]),
      findOne: jest.fn().mockResolvedValue(genre),
      create: jest.fn().mockReturnValue(genre),
      save: jest.fn().mockResolvedValue(genre),
      findBy: jest.fn().mockResolvedValue([genre]),
    };
    eraRepo = {
      find: jest.fn().mockResolvedValue([era]),
      findOne: jest.fn().mockResolvedValue(era),
      create: jest.fn().mockReturnValue(era),
      save: jest.fn().mockResolvedValue(era),
      findBy: jest.fn().mockResolvedValue([era]),
    };
    civilizationRepo = {
      find: jest.fn().mockResolvedValue([civilization]),
      findOne: jest.fn().mockResolvedValue(civilization),
      create: jest.fn().mockReturnValue(civilization),
      save: jest.fn().mockResolvedValue(civilization),
      findBy: jest.fn().mockResolvedValue([civilization]),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        StoryOptionsService,
        { provide: getRepositoryToken(StoryGenre), useValue: genreRepo },
        {
          provide: getRepositoryToken(StoryEraOption),
          useValue: eraRepo,
        },
        {
          provide: getRepositoryToken(StoryCivilizationOption),
          useValue: civilizationRepo,
        },
        { provide: AuditLogService, useValue: auditService },
      ],
    }).compile();

    service = module.get(StoryOptionsService);
  });

  describe('findAll', () => {
    it('lists active genres', async () => {
      const result = await service.findAll('genre');
      expect(genreRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fantasy');
    });

    it('includes inactive when requested', async () => {
      await service.findAll('genre', false);
      expect(genreRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the option', async () => {
      const result = await service.findOne('genre', 'genre-1');
      expect(result.id).toBe('genre-1');
    });

    it('throws NotFoundException when missing', async () => {
      genreRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('genre', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates and audits a new option', async () => {
      genreRepo.findOne.mockResolvedValue(null);
      const result = await service.create(
        'genre',
        { name: 'Steampunk' },
        { id: 'admin-1' },
      );
      expect(genreRepo.create).toHaveBeenCalledWith({
        name: 'Steampunk',
        description: null,
        legacyValue: null,
        createdBy: 'admin-1',
      });
      expect(result.name).toBe('Fantasy');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-1',
          action: 'STORY_GENRE_CREATED',
          targetType: 'STORY_GENRE',
        }),
      );
    });

    it('throws ConflictException for duplicate', async () => {
      await expect(
        service.create('genre', { name: 'Fantasy' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('renames and audits', async () => {
      genreRepo.findOne.mockResolvedValue({ ...genre });
      await service.update(
        'genre',
        'genre-1',
        { name: 'Fantasy Epic' },
        { id: 'admin-1' },
      );
      expect(genreRepo.save).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORY_GENRE_UPDATED',
        }),
      );
    });

    it('rejects duplicate names', async () => {
      const other = { ...genre, id: 'genre-2', name: 'Mystery' };
      genreRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve(where?.id === 'genre-2' ? other : genre),
      );
      await expect(
        service.update('genre', 'genre-2', { name: 'Fantasy' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivate', () => {
    it('soft-deletes by flipping isActive', async () => {
      genreRepo.findOne.mockResolvedValue(genre);
      await service.deactivate('genre', 'genre-1', { id: 'admin-1' });
      expect(genreRepo.save).toHaveBeenCalledWith({
        ...genre,
        isActive: false,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STORY_GENRE_DEACTIVATED',
        }),
      );
    });
  });

  describe('resolveNames', () => {
    it('resolves names from all three option tables', async () => {
      const result = await service.resolveNames(
        'genre-1',
        'era-1',
        'civ-1',
      );
      expect(result).toEqual({
        genreName: 'Fantasy',
        eraName: 'Common Era',
        civilizationName: 'Ancient Egyptian',
      });
    });

    it('returns nulls when no ids given', async () => {
      const result = await service.resolveNames(null, null, null);
      expect(result).toEqual({
        genreName: null,
        eraName: null,
        civilizationName: null,
      });
    });
  });
});