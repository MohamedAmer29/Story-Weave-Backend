import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: sendMailMock,
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    const configService = {
      get: jest.fn((key: string, def?: unknown) => {
        const values: Record<string, unknown> = {
          'email.smtpHost': 'smtp.test.com',
          'email.smtpPort': 587,
          'email.smtpUser': 'user',
          'email.smtpPass': 'pass',
          'email.from': 'no-reply@test.com',
        };
        return values[key] ?? def;
      }),
    } as unknown as ConfigService;
    service = new EmailService(configService);
  });

  describe('sendVerificationEmail', () => {
    it('sends a verification email with the otp', async () => {
      sendMailMock.mockResolvedValue({ messageId: 'm1' });
      await service.sendVerificationEmail('user@test.com', '123456');

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Verify your email address',
          from: 'no-reply@test.com',
          html: expect.stringContaining('123456'),
        }),
      );
    });

    it('rethrows errors from the transporter', async () => {
      sendMailMock.mockRejectedValue(new Error('smtp down'));
      await expect(
        service.sendVerificationEmail('user@test.com', '123456'),
      ).rejects.toThrow('smtp down');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends a reset email with the otp', async () => {
      sendMailMock.mockResolvedValue({ messageId: 'm2' });
      await service.sendPasswordResetEmail('user@test.com', '654321');
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Reset your password',
          html: expect.stringContaining('654321'),
        }),
      );
    });

    it('rethrows errors', async () => {
      sendMailMock.mockRejectedValue(new Error('smtp down'));
      await expect(
        service.sendPasswordResetEmail('user@test.com', '654321'),
      ).rejects.toThrow('smtp down');
    });
  });
});
