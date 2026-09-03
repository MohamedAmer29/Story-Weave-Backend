import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UuidParamDto {
  @ApiProperty({ description: 'UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  id: string;
}

export class UuidPairParamDto {
  @ApiProperty({ description: 'Parent UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  id: string;

  @ApiProperty({ description: 'Child UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  childId: string;
}

export class UuidTargetUserIdParamDto {
  @ApiProperty({ description: 'Story UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  id: string;

  @ApiProperty({ description: 'Target user UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  targetUserId: string;
}

export class StoryIdParamDto {
  @ApiProperty({ description: 'Story UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  storyId: string;
}

export class StoryPageIdParamDto {
  @ApiProperty({ description: 'Story UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  storyId: string;

  @ApiProperty({ description: 'Page UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  pageId: string;
}

export class StoryTargetUserIdParamDto {
  @ApiProperty({ description: 'Story UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  storyId: string;

  @ApiProperty({ description: 'Target user UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  targetUserId: string;
}

export class SessionIdParamDto {
  @ApiProperty({ description: 'Session UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  sessionId: string;
}

export class UserIdParamDto {
  @ApiProperty({ description: 'User UUID identifier', format: 'uuid' })
  @IsUUID('4', { message: 'Invalid identifier format' })
  userId: string;
}
