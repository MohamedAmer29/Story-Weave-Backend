import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('cloudinary.cloudName');
    const apiKey = this.configService.get<string>('cloudinary.apiKey');
    const apiSecret = this.configService.get<string>('cloudinary.apiSecret');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  async uploadImage(
    buffer: Buffer,
    options: { folder: string; publicId?: string },
  ): Promise<CloudinaryUploadResult> {
    this.logger.log('Cloudinary upload started');

    return new Promise((resolve, reject) => {
      const uploadOptions: Record<string, any> = {
        folder: options.folder,
        resource_type: 'image',
        overwrite: true,
      };

      if (options.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      cloudinary.uploader
        .upload_stream(uploadOptions as any, (error, result) => {
          if (error) {
            this.logger.error(
              `Cloudinary upload failed: ${error.message}`,
              error.stack,
            );
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
            return;
          }

          if (!result) {
            this.logger.error('Cloudinary upload returned no result');
            reject(new Error('Cloudinary upload returned no result'));
            return;
          }

          this.logger.log(
            `Cloudinary upload completed. Public ID: ${result.public_id}`,
          );
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
          });
        })
        .end(buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!publicId) {
      return;
    }

    this.logger.log(`Cloudinary delete started for: ${publicId}`);

    try {
      await new Promise<void>((resolve, reject) => {
        cloudinary.uploader.destroy(
          publicId,
          { resource_type: 'image' },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(result);
          },
        );
      });

      this.logger.log(`Cloudinary delete completed for: ${publicId}`);
    } catch (error: any) {
      this.logger.error(
        `Cloudinary delete failed for ${publicId}: ${error.message}`,
      );
    }
  }
}
