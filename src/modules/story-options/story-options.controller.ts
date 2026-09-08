import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { StoryOptionsService, StoryOptionKind } from './story-options.service';
import { CreateStoryOptionDto } from './dto/create-story-option.dto';
import { UpdateStoryOptionDto } from './dto/update-story-option.dto';
import { StoryOptionResponseDto } from './dto/story-option-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Story Options')
@Controller('story-options')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoryOptionsController {
  constructor(private readonly storyOptionsService: StoryOptionsService) {}

  @Get('genres')
  @ApiOperation({ summary: 'List all active story genres' })
  @ApiResponse({ status: 200, type: [StoryOptionResponseDto] })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async listGenres(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<StoryOptionResponseDto[]> {
    return this.storyOptionsService.findAll(
      'genre',
      includeInactive !== 'true',
    );
  }

  @Get('eras')
  @ApiOperation({ summary: 'List all active story eras' })
  @ApiResponse({ status: 200, type: [StoryOptionResponseDto] })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async listEras(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<StoryOptionResponseDto[]> {
    return this.storyOptionsService.findAll(
      'era',
      includeInactive !== 'true',
    );
  }

  @Get('civilizations')
  @ApiOperation({ summary: 'List all active story civilizations' })
  @ApiResponse({ status: 200, type: [StoryOptionResponseDto] })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async listCivilizations(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<StoryOptionResponseDto[]> {
    return this.storyOptionsService.findAll(
      'civilization',
      includeInactive !== 'true',
    );
  }

  @Post('genres')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Create a new story genre' })
  @ApiResponse({ status: 201, type: StoryOptionResponseDto })
  async createGenre(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateStoryOptionDto,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.create('genre', dto, { id: actorId });
  }

  @Post('eras')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Create a new story era' })
  @ApiResponse({ status: 201, type: StoryOptionResponseDto })
  async createEra(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateStoryOptionDto,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.create('era', dto, { id: actorId });
  }

  @Post('civilizations')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Create a new story civilization' })
  @ApiResponse({ status: 201, type: StoryOptionResponseDto })
  async createCivilization(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateStoryOptionDto,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.create('civilization', dto, { id: actorId });
  }

  @Patch('genres/:id')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Update a story genre' })
  @ApiResponse({ status: 200, type: StoryOptionResponseDto })
  async updateGenre(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStoryOptionDto,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.update('genre', id, dto, { id: actorId });
  }

  @Patch('eras/:id')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Update a story era' })
  @ApiResponse({ status: 200, type: StoryOptionResponseDto })
  async updateEra(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStoryOptionDto,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.update('era', id, dto, { id: actorId });
  }

  @Patch('civilizations/:id')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Update a story civilization' })
  @ApiResponse({ status: 200, type: StoryOptionResponseDto })
  async updateCivilization(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStoryOptionDto,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.update('civilization', id, dto, {
      id: actorId,
    });
  }

  @Delete('genres/:id')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Deactivate a story genre (soft delete)' })
  @ApiResponse({ status: 200, type: StoryOptionResponseDto })
  async deactivateGenre(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.deactivate('genre', id, { id: actorId });
  }

  @Delete('eras/:id')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Deactivate a story era (soft delete)' })
  @ApiResponse({ status: 200, type: StoryOptionResponseDto })
  async deactivateEra(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.deactivate('era', id, { id: actorId });
  }

  @Delete('civilizations/:id')
  @Roles(UserRole.ADMIN, UserRole.AUTHOR)
  @ApiOperation({ summary: 'Deactivate a story civilization (soft delete)' })
  @ApiResponse({ status: 200, type: StoryOptionResponseDto })
  async deactivateCivilization(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
  ): Promise<StoryOptionResponseDto> {
    return this.storyOptionsService.deactivate('civilization', id, {
      id: actorId,
    });
  }
}
