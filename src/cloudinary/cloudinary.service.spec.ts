import { CloudinaryService } from './cloudinary.service';
import { ConfigService } from '@nestjs/config';

jest.mock('cloudinary');

import { v2 as cloudinary } from 'cloudinary';

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  const uploaderMock = cloudinary.uploader as jest.Mocked<typeof cloudinary.uploader>;

  const makeConfig = (withCreds = true) => {
    const values: Record<string, unknown> = withCreds
      ? {
          'cloudinary.cloudName': 'test-cloud',
          'cloudinary.apiKey': 'key',
          'cloudinary.apiSecret': 'secret',
        }
      : {};
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  // Helper: make upload_stream invoke a success callback and record options.
  const mockUploadSuccess = (result: any = null) => {
    let capturedOptions: any;
    (uploaderMock.upload_stream as any).mockImplementation((options: any, callback: any) => {
      capturedOptions = options;
      callback(null, result ?? { secure_url: 'https://cdn/x.png', public_id: 'abc' });
      return { end: jest.fn() };
    });
    return () => capturedOptions;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CloudinaryService(makeConfig());
  });

  describe('constructor', () => {
    it('configures cloudinary when all credentials present', () => {
      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'key',
        api_secret: 'secret',
      });
    });

    it('skips configuration when credentials missing', () => {
      jest.clearAllMocks();
      new CloudinaryService(makeConfig(false));
      expect(cloudinary.config).not.toHaveBeenCalled();
    });
  });

  describe('uploadImage', () => {
    it('uploads a buffer and returns secure url + public id', async () => {
      const getOptions = mockUploadSuccess();
      const result = await service.uploadImage(Buffer.from('data'), {
        folder: 'stories/s1',
      });
      expect(result).toEqual({
        secureUrl: 'https://cdn/x.png',
        publicId: 'abc',
      });
      const options = getOptions();
      expect(options.folder).toBe('stories/s1');
      expect(options.resource_type).toBe('image');
      expect(options.overwrite).toBe(true);
    });

    it('passes a publicId through to upload options', async () => {
      const getOptions = mockUploadSuccess();
      await service.uploadImage(Buffer.from('x'), {
        folder: 'f',
        publicId: 'my-public-id',
      });
      expect(getOptions().public_id).toBe('my-public-id');
    });

    it('rejects when cloudinary reports an error', async () => {
      (uploaderMock.upload_stream as any).mockImplementation(
        (_opts: any, callback: any) => {
          callback(new Error('upload failed'), null);
          return { end: jest.fn() };
        },
      );
      await expect(
        service.uploadImage(Buffer.from('x'), { folder: 'f' }),
      ).rejects.toThrow('Cloudinary upload failed');
    });

    it('rejects when no result is returned', async () => {
      (uploaderMock.upload_stream as any).mockImplementation(
        (_opts: any, callback: any) => {
          callback(null, null);
          return { end: jest.fn() };
        },
      );
      await expect(
        service.uploadImage(Buffer.from('x'), { folder: 'f' }),
      ).rejects.toThrow('no result');
    });
  });

  describe('deleteImage', () => {
    it('resolves immediately for empty publicId', async () => {
      await expect(service.deleteImage('')).resolves.toBeUndefined();
      await expect(service.deleteImage(undefined as any)).resolves.toBeUndefined();
      expect(uploaderMock.destroy).not.toHaveBeenCalled();
    });

    it('calls destroy and resolves on success', async () => {
      (uploaderMock.destroy as any).mockImplementation(
        (_id: any, _opts: any, callback: any) => callback(null, { result: 'ok' }),
      );
      await expect(service.deleteImage('abc')).resolves.toBeUndefined();
      expect(uploaderMock.destroy).toHaveBeenCalledWith(
        'abc',
        { resource_type: 'image' },
        expect.any(Function),
      );
    });

    it('swallows errors on destroy', async () => {
      (uploaderMock.destroy as any).mockImplementation(
        (_id: any, _opts: any, callback: any) =>
          callback(new Error('destroy failed'), null),
      );
      await expect(service.deleteImage('abc')).resolves.toBeUndefined();
    });
  });
});
