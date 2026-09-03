import { BadRequestException } from '@nestjs/common';
import { PdfParserService } from './pdf-parser.service';

const pdfParserMock = jest.fn();

jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: (...args: unknown[]) => pdfParserMock(...args),
}));

describe('PdfParserService', () => {
  let service: PdfParserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PdfParserService();
  });

  describe('extractText', () => {
    it('extracts and normalizes text from a pdf buffer', async () => {
      pdfParserMock.mockResolvedValue({
        text: 'Hello  world\r\n\r\n\r\nsecond page',
        numpages: 2,
      });

      const result = await service.extractText(Buffer.from('fake'));
      // \r\n collapsed, triple newlines collapsed to double, whitespace kept per-line
      expect(result).toContain('Hello  world');
      expect(result).not.toContain('\r');
    });

    it('throws BadRequestException for empty extracted text', async () => {
      pdfParserMock.mockResolvedValue({ text: '   \n  ' });
      await expect(service.extractText(Buffer.from('x'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when pdf parsing fails', async () => {
      pdfParserMock.mockRejectedValue(new Error('corrupt pdf'));
      await expect(service.extractText(Buffer.from('x'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.extractText(Buffer.from('x'))).rejects.toThrow(
        'Failed to parse PDF file',
      );
    });

    it('propagates BadRequestException from the parser directly', async () => {
      pdfParserMock.mockRejectedValue(
        new BadRequestException('PDF contains no extractable text'),
      );
      await expect(service.extractText(Buffer.from('x'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
