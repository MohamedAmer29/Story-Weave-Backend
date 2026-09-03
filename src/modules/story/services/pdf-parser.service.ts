import { Injectable, Logger, BadRequestException } from '@nestjs/common';
// pdf-parse exports a function; use default import to call it directly
import pdf from 'pdf-parse';

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async extractText(buffer: Buffer): Promise<string> {
    this.logger.log('Starting PDF text extraction');

    try {
      const data = await pdf(buffer);

      if (!data.text || data.text.trim().length === 0) {
        this.logger.error('PDF contains no extractable text');
        throw new BadRequestException('PDF contains no extractable text');
      }

      this.logger.log(
        `PDF text extracted successfully, length: ${data.text.length} characters`,
      );
      this.logger.debug(`Number of pages: ${data.numpages}`);

      return this.normalizeText(data.text);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Log detailed error for diagnostics (stack included)
      this.logger.error(
        `PDF parsing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      // Surface a clearer message if pdf-parse produced a known error
      const msg =
        error && error.message ? error.message : 'Failed to parse PDF file';
      throw new BadRequestException('Failed to parse PDF file');
    }
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
