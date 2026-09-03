import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { hash, compare } from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { User, UserRole } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { EmailService } from '../common/services/email.service';
import { OtpService } from '../common/services/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RedisService } from '../config/redis.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly otpService: OtpService,
    private readonly redisService: RedisService,
  ) {}

  private get refreshExpiresInDays(): number {
    return this.configService.get<number>('auth.refreshExpiresInDays', 7);
  }

  private get refreshRememberMeDays(): number {
    return this.configService.get<number>('auth.refreshRememberMeDays', 30);
  }

  private get resetTokenExpiresIn(): string {
    return this.configService.get<string>('auth.resetTokenExpiresIn', '15m');
  }

  private generateRefreshToken(): string {
    return randomBytes(40).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(user: User, sessionId?: string): string {
    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    return this.jwtService.sign(payload);
  }

  private getExpirationDate(days: number): Date {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return now;
  }

  private async createRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    rememberMe = false,
  ): Promise<{ token: string; refreshToken: RefreshToken }> {
    const rawToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(rawToken);
    const days = rememberMe
      ? this.refreshRememberMeDays
      : this.refreshExpiresInDays;

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token: tokenHash,
      ipAddress,
      userAgent,
      expiresAt: this.getExpirationDate(days),
    });

    const saved = await this.refreshTokenRepository.save(refreshToken);
    return { token: rawToken, refreshToken: saved };
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepository.create({
      email: normalizedEmail,
      password: passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      name: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
      role: UserRole.USER,
      isActive: true,
      emailVerified: false,
    });

    const savedUser = await this.userRepository.save(user);

    const { token: refreshToken, refreshToken: savedRefreshToken } =
      await this.createRefreshToken(savedUser.id, ipAddress, userAgent);

    const accessToken = this.signAccessToken(savedUser, savedRefreshToken.id);

    try {
      const otp = await this.otpService.generate(savedUser.id, 'verify');
      await this.emailService.sendVerificationEmail(normalizedEmail, otp);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${normalizedEmail}`,
        error,
      );
    }

    this.logger.log(`User registered: ${normalizedEmail}`);

    return {
      user: this.sanitizeUser(savedUser),
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    const { token: refreshToken, refreshToken: savedRefreshToken } =
      await this.createRefreshToken(
        user.id,
        ipAddress,
        userAgent,
        dto.rememberMe,
      );

    const accessToken = this.signAccessToken(user, savedRefreshToken.id);

    this.logger.log(`User logged in: ${normalizedEmail}`);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(
    refreshTokenValue: string | undefined,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!refreshTokenValue) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokenHash = this.hashToken(refreshTokenValue);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash, revokedAt: IsNull() },
      relations: { user: true },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date(refreshToken.expiresAt) < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = refreshToken.user;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is unavailable');
    }

    await this.refreshTokenRepository.update(refreshToken.id, {
      revokedAt: new Date(),
    });

    const { token: newRefreshToken, refreshToken: savedRefreshToken } =
      await this.createRefreshToken(user.id, ipAddress, userAgent);

    const accessToken = this.signAccessToken(user, savedRefreshToken.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshTokenValue?: string) {
    if (refreshTokenValue) {
      const tokenHash = this.hashToken(refreshTokenValue);
      await this.refreshTokenRepository.update(
        { token: tokenHash, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }
  }

  async logoutAll(userId: string) {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    this.logger.log(`All sessions revoked for user: ${userId}`);
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async forgotPassword(dto: { email: string }) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return {
        message:
          'If the account exists and requires verification, a verification email has been sent.',
      };
    }

    const isCoolingDown = await this.otpService.isCoolingDown(user.id, 'reset');
    if (isCoolingDown) {
      return {
        message:
          'If the account exists and requires verification, a verification email has been sent.',
      };
    }

    try {
      const otp = await this.otpService.generate(user.id, 'reset');
      await this.emailService.sendPasswordResetEmail(normalizedEmail, otp);
      await this.otpService.setCooldown(user.id, 'reset');
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${normalizedEmail}`,
        error,
      );
    }

    return {
      message:
        'If the account exists and requires verification, a verification email has been sent.',
    };
  }

  async verifyResetOtp(dto: { email: string; otp: string }) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid request');
    }

    const attempts = await this.otpService.getAttempts(user.id, 'reset');
    if (attempts >= this.configService.get<number>('otp.maxAttempts', 5)) {
      throw new BadRequestException(
        'Too many attempts. Please request a new code.',
      );
    }

    const valid = await this.otpService.verify(user.id, 'reset', dto.otp);
    if (!valid) {
      throw new BadRequestException('Invalid or expired code');
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: 'password-reset' },
      { expiresIn: this.resetTokenExpiresIn as any },
    );

    return { resetToken };
  }

  async resetPassword(dto: { resetToken: string; newPassword: string }) {
    let payload: { sub: string; purpose: string };
    try {
      const verified = this.jwtService.verify(dto.resetToken);
      payload = verified;
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.purpose !== 'password-reset') {
      throw new UnauthorizedException('Invalid reset token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is unavailable');
    }

    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, { password: passwordHash });

    await this.refreshTokenRepository.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    this.logger.log(`Password reset for user: ${user.email}`);

    return { message: 'Password reset successful. Please log in again.' };
  }

  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
  ) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id, { password: passwordHash });

    await this.refreshTokenRepository.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  async verifyEmail(dto: { email: string; otp: string }) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid request');
    }

    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    const attempts = await this.otpService.getAttempts(user.id, 'verify');
    if (attempts >= this.configService.get<number>('otp.maxAttempts', 5)) {
      throw new BadRequestException(
        'Too many attempts. Please request a new code.',
      );
    }

    const valid = await this.otpService.verify(user.id, 'verify', dto.otp);
    if (!valid) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.userRepository.update(user.id, { emailVerified: true });

    this.logger.log(`Email verified for user: ${normalizedEmail}`);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(dto: { email: string }) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    const response = {
      message:
        'If the account exists and requires verification, a verification email has been sent.',
    };

    if (!user || !user.isActive || user.emailVerified) {
      return response;
    }

    const isCoolingDown = await this.otpService.isCoolingDown(
      user.id,
      'verify',
    );
    if (isCoolingDown) {
      return response;
    }

    try {
      await this.otpService.invalidate(user.id, 'verify');
      const otp = await this.otpService.generate(user.id, 'verify');
      await this.emailService.sendVerificationEmail(normalizedEmail, otp);
      await this.otpService.setCooldown(user.id, 'verify');
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email to ${normalizedEmail}`,
        error,
      );
    }

    return response;
  }

  async getSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.refreshTokenRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    return sessions.map((session) => ({
      id: session.id,
      device: session.userAgent || 'Unknown device',
      ipAddress: session.ipAddress || 'Unknown',
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      current: currentSessionId ? session.id === currentSessionId : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.refreshTokenRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.revokedAt) {
      return { message: 'Session already revoked' };
    }

    await this.refreshTokenRepository.update(session.id, {
      revokedAt: new Date(),
    });

    return { message: 'Session revoked' };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const query = this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL');

    if (currentSessionId) {
      query.andWhere('id != :currentSessionId', { currentSessionId });
    }

    await query.execute();

    return { message: 'Other sessions revoked' };
  }
}
