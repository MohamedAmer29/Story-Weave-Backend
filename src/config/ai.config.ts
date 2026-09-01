import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  apiKey: process.env.AI_API_KEY,
  provider: process.env.AI_PROVIDER,
  model: process.env.AI_MODEL,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  imageConcurrency: parseInt(process.env.AI_IMAGE_CONCURRENCY || '2', 10),
}));
