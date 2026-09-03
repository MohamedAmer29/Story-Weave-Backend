import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../database/entities/user.entity';
import { Story } from '../../database/entities/story.entity';
import { AdminUserQueryDto } from '../dto/admin-query.dto';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
  ) {}

  async list(query: AdminUserQueryDto) {
    const page = query.page > 0 ? query.page : 1;
    const limit = query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.userRepository.createQueryBuilder('user');

    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.name ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('user.createdAt', 'DESC');

    const [users, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const storyCounts = await this.storyRepository
      .createQueryBuilder('story')
      .select('story.userId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('story.userId IN (:...ids)', {
        ids: users.map((u) => u.id),
      })
      .groupBy('story.userId')
      .getRawMany();

    const countMap = new Map(
      storyCounts.map((r) => [r.userId, Number(r.count) || 0]),
    );

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      __password: undefined,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      storyCount: countMap.get(u.id) ?? 0,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  private async findUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getById(userId: string) {
    const user = await this.findUser(userId);
    const storyCount = await this.storyRepository.count({
      where: { userId },
    });
    const { __password, ...rest } = user as unknown as Record<string, unknown>;
    return { ...rest, storyCount };
  }

  async updateRole(
    actor: { id: string; email?: string },
    userId: string,
    role: UserRole,
  ) {
    const user = await this.findUser(userId);

    if (user.id === actor.id && role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'You cannot revoke your own ADMIN role',
      );
    }

    user.role = role;
    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async setActive(
    actor: { id: string },
    userId: string,
    isActive: boolean,
  ) {
    const user = await this.findUser(userId);

    if (user.id === actor.id && !isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    user.isActive = isActive;
    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
    };
  }
}
