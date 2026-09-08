import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { StoryGenre } from '../../database/entities/story-genre.entity';
import { StoryEraOption } from '../../database/entities/story-era.entity';
import { StoryCivilizationOption } from '../../database/entities/story-civilization.entity';
import { CreateStoryOptionDto } from './dto/create-story-option.dto';
import { UpdateStoryOptionDto } from './dto/update-story-option.dto';
import { StoryOptionResponseDto } from './dto/story-option-response.dto';
import { AuditLogService } from '../../admin/audit/audit-log.service';
import { AuditAction } from '../../admin/audit/audit-actions';

export type StoryOptionKind = 'genre' | 'era' | 'civilization';

@Injectable()
export class StoryOptionsService {
  private readonly logger = new Logger(StoryOptionsService.name);

  constructor(
    @InjectRepository(StoryGenre)
    private readonly genreRepo: Repository<StoryGenre>,
    @InjectRepository(StoryEraOption)
    private readonly eraRepo: Repository<StoryEraOption>,
    @InjectRepository(StoryCivilizationOption)
    private readonly civilizationRepo: Repository<StoryCivilizationOption>,
    private readonly auditLogService: AuditLogService,
  ) {}

  private repoFor(kind: StoryOptionKind) {
    switch (kind) {
      case 'genre':
        return this.genreRepo;
      case 'era':
        return this.eraRepo;
      case 'civilization':
        return this.civilizationRepo;
    }
  }

  async findAll(
    kind: StoryOptionKind,
    activeOnly = true,
  ): Promise<StoryOptionResponseDto[]> {
    const repo = this.repoFor(kind);
    const where = activeOnly ? { isActive: true } : {};
    const items = await repo.find({ where, order: { name: 'ASC' } });
    return items.map((item) => this.toResponseDto(item));
  }

  async findOne(
    kind: StoryOptionKind,
    id: string,
  ): Promise<StoryOptionResponseDto> {
    const repo = this.repoFor(kind);
    const item = await repo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`${kind} option not found`);
    }
    return this.toResponseDto(item);
  }

  async findOneEntity(
    kind: StoryOptionKind,
    id: string,
  ): Promise<StoryGenre | StoryEraOption | StoryCivilizationOption> {
    const repo = this.repoFor(kind);
    const item = await repo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`${kind} option not found`);
    }
    return item;
  }

  async create(
    kind: StoryOptionKind,
    dto: CreateStoryOptionDto,
    actor?: { id: string },
  ): Promise<StoryOptionResponseDto> {
    const repo = this.repoFor(kind);
    const existing = await repo.findOne({
      where: { name: ILike(dto.name) },
    });
    if (existing) {
      throw new ConflictException(
        `${kind} option with name "${dto.name}" already exists`,
      );
    }
    const item = repo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      legacyValue: dto.legacyValue?.trim() || null,
      createdBy: actor?.id || null,
    });
    const saved = await repo.save(item);
    this.logger.log(`${kind} option created: ${saved.id}`);
    if (actor) {
      void this.auditLogService.record({
        adminId: actor.id,
        action: this.actionFor('created', kind),
        targetType: this.targetTypeFor(kind),
        targetId: saved.id,
        description: `${kind} option "${saved.name}" created`,
        metadata: { name: saved.name },
      });
    }
    return this.toResponseDto(saved);
  }

  async update(
    kind: StoryOptionKind,
    id: string,
    dto: UpdateStoryOptionDto,
    actor?: { id: string },
  ): Promise<StoryOptionResponseDto> {
    const repo = this.repoFor(kind);
    const item = await repo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`${kind} option not found`);
    }
    if (dto.name !== undefined && dto.name.trim() !== item.name) {
      const duplicate = await repo.findOne({
        where: { name: ILike(dto.name) },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `${kind} option with name "${dto.name}" already exists`,
        );
      }
      item.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      item.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      item.isActive = dto.isActive;
    }
    const saved = await repo.save(item);
    if (actor) {
      void this.auditLogService.record({
        adminId: actor.id,
        action: this.actionFor('updated', kind),
        targetType: this.targetTypeFor(kind),
        targetId: saved.id,
        description: `${kind} option "${saved.name}" updated`,
        metadata: { name: saved.name, isActive: saved.isActive },
      });
    }
    return this.toResponseDto(saved);
  }

  async deactivate(
    kind: StoryOptionKind,
    id: string,
    actor?: { id: string },
  ): Promise<StoryOptionResponseDto> {
    const repo = this.repoFor(kind);
    const item = await repo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`${kind} option not found`);
    }
    item.isActive = false;
    const saved = await repo.save(item);
    if (actor) {
      void this.auditLogService.record({
        adminId: actor.id,
        action: this.actionFor('deactivated', kind),
        targetType: this.targetTypeFor(kind),
        targetId: saved.id,
        description: `${kind} option "${saved.name}" deactivated`,
        metadata: { name: saved.name },
      });
    }
    return this.toResponseDto(saved);
  }

  private actionFor(
    verb: 'created' | 'updated' | 'deactivated',
    kind: StoryOptionKind,
  ): string {
    const actionMap: Record<
      StoryOptionKind,
      { created: string; updated: string; deactivated: string }
    > = {
      genre: {
        created: AuditAction.STORY_GENRE_CREATED,
        updated: AuditAction.STORY_GENRE_UPDATED,
        deactivated: AuditAction.STORY_GENRE_DEACTIVATED,
      },
      era: {
        created: AuditAction.STORY_ERA_CREATED,
        updated: AuditAction.STORY_ERA_UPDATED,
        deactivated: AuditAction.STORY_ERA_DEACTIVATED,
      },
      civilization: {
        created: AuditAction.STORY_CIVILIZATION_CREATED,
        updated: AuditAction.STORY_CIVILIZATION_UPDATED,
        deactivated: AuditAction.STORY_CIVILIZATION_DEACTIVATED,
      },
    };
    return actionMap[kind][verb];
  }

  private targetTypeFor(kind: StoryOptionKind): string {
    const map: Record<StoryOptionKind, string> = {
      genre: 'STORY_GENRE',
      era: 'STORY_ERA',
      civilization: 'STORY_CIVILIZATION',
    };
    return map[kind];
  }

  async findActiveByName(
    kind: StoryOptionKind,
    name: string,
  ): Promise<StoryGenre | StoryEraOption | StoryCivilizationOption | null> {
    const repo = this.repoFor(kind);
    return repo.findOne({
      where: { name: ILike(name), isActive: true },
    });
  }

  async findByIds(
    kind: StoryOptionKind,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const repo = this.repoFor(kind);
    const items = await repo.findBy({ id: In(ids) });
    return new Map(items.map((item) => [item.id, item.name]));
  }

  async resolveNames(
    genreId?: string | null,
    eraId?: string | null,
    civilizationId?: string | null,
  ): Promise<{
    genreName: string | null;
    eraName: string | null;
    civilizationName: string | null;
  }> {
    const ids = [genreId, eraId, civilizationId].filter(
      (id): id is string => id !== null && id !== undefined,
    );
    if (ids.length === 0) {
      return { genreName: null, eraName: null, civilizationName: null };
    }
    const [genreNames, eraNames, civNames] = await Promise.all([
      genreId ? this.findByIds('genre', [genreId]) : new Map(),
      eraId ? this.findByIds('era', [eraId]) : new Map(),
      civilizationId
        ? this.findByIds('civilization', [civilizationId])
        : new Map(),
    ]);
    return {
      genreName: genreId ? (genreNames.get(genreId) ?? null) : null,
      eraName: eraId ? (eraNames.get(eraId) ?? null) : null,
      civilizationName: civilizationId
        ? (civNames.get(civilizationId) ?? null)
        : null,
    };
  }

  private toResponseDto(
    item: StoryGenre | StoryEraOption | StoryCivilizationOption,
  ): StoryOptionResponseDto {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      isActive: item.isActive,
      legacyValue: item.legacyValue,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
