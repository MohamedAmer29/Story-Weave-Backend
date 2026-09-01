import { Injectable, Logger, BadRequestException } from '@nestjs/common';

const MAX_AI_PROMPT_LENGTH = 2000;

@Injectable()
export class PromptValidationService {
  private readonly logger = new Logger(PromptValidationService.name);

  validateImagePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new BadRequestException('Invalid prompt: prompt must be a non-empty string');
    }

    const trimmed = prompt.trim();

    if (trimmed.length === 0) {
      throw new BadRequestException('Invalid prompt: prompt cannot be empty');
    }

    if (trimmed.length > MAX_AI_PROMPT_LENGTH) {
      this.logger.error(
        `Prompt validation failed: length ${trimmed.length} exceeds maximum ${MAX_AI_PROMPT_LENGTH}`,
      );
      throw new BadRequestException(
        `Invalid prompt: length ${trimmed.length} exceeds maximum ${MAX_AI_PROMPT_LENGTH} characters`,
      );
    }

    this.logger.debug(
      `Prompt validation passed: length ${trimmed.length}/${MAX_AI_PROMPT_LENGTH}`,
    );
    return trimmed;
  }

  getMaxPromptLength(): number {
    return MAX_AI_PROMPT_LENGTH;
  }
}
