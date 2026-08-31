import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as pdf from 'pdf-parse';

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

      this.logger.log(`PDF text extracted successfully, length: ${data.text.length} characters`);
      this.logger.debug(`Number of pages: ${data.numpages}`);

      return this.normalizeText(data.text);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`PDF parsing failed: ${error.message}`);
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
