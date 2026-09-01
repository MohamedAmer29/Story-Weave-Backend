import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10', 10),
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  resendCooldownSeconds: parseInt(
    process.env.OTP_RESEND_COOLDOWN_SECONDS || '60',
    10,
  ),
}));
