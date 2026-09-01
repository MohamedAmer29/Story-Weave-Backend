import { registerAs } from '@nestjs/config';

export default registerAs('notification', () => ({
  retentionDays: parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '90', 10),
  cleanupIntervalHours: parseInt(
    process.env.NOTIFICATION_CLEANUP_INTERVAL_HOURS || '24',
    10,
  ),
}));
