import { User, UserRole } from '../../database/entities/user.entity';

export interface UserProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  name: string | null;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
}

export function toUserProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  };
}
