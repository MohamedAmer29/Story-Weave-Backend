import { registerAs } from '@nestjs/config';

export default registerAs('admin', () => ({
  email: process.env.ADMIN_EMAIL || '',
  password: process.env.ADMIN_PASSWORD || '',
}));
