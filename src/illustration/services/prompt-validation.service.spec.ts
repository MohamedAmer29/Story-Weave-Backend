import { BadRequestException } from '@nestjs/common';
import { PromptValidationService } from './prompt-validation.service';

describe('PromptValidationService', () => {
  const svc = new PromptValidationService();

  describe('validateImagePrompt', () => {
    it('throws for non-string input', () => {
      expect(() => svc.validateImagePrompt(null as any)).toThrow(
        BadRequestException,
      );
      expect(() => svc.validateImagePrompt(undefined as any)).toThrow(
        BadRequestException,
      );
      expect(() => svc.validateImagePrompt(123 as any)).toThrow(
        BadRequestException,
      );
    });

    it('throws for empty/whitespace prompt', () => {
      expect(() => svc.validateImagePrompt('')).toThrow(BadRequestException);
      expect(() => svc.validateImagePrompt('   ')).toThrow(BadRequestException);
    });

    it('returns the trimmed prompt for valid input', () => {
      expect(svc.validateImagePrompt('  a nice scene  ')).toBe('a nice scene');
    });

    it('throws when prompt exceeds the max length', () => {
      const tooLong = 'x'.repeat(svc.getMaxPromptLength() + 1);
      expect(() => svc.validateImagePrompt(tooLong)).toThrow(BadRequestException);
    });

    it('accepts a prompt exactly at the max length', () => {
      const atLimit = 'x'.repeat(svc.getMaxPromptLength());
      expect(svc.validateImagePrompt(atLimit)).toHaveLength(
        svc.getMaxPromptLength(),
      );
    });

    it('reports the max prompt length', () => {
      expect(svc.getMaxPromptLength()).toBe(2000);
    });
  });
});
