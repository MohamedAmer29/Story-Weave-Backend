import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcrypt';
import { User, UserRole } from '../database/entities/user.entity';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService
      .get<string>('admin.email', '')
      ?.trim()
      ?.toLowerCase();
    const password = this.configService.get<string>('admin.password', '') || '';

    if (!email || !password) {
      return;
    }

    try {
      const existing = await this.userRepository.findOne({
        where: { email },
      });

      if (existing) {
        return;
      }

      const passwordHash = await hash(password, 12);
      const name = email.split('@')[0];

      const admin = this.userRepository.create({
        email,
        password: passwordHash,
        firstName: 'Admin',
        lastName: 'Admin',
        name,
        role: UserRole.ADMIN,
        isActive: true,
        emailVerified: true,
      });

      await this.userRepository.save(admin);
      this.logger.log(`Initial admin account auto-created for ${email}`);
    } catch (error) {
      this.logger.error('Failed to bootstrap admin account', error);
    }
  }
}
