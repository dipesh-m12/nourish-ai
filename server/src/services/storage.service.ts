import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

/**
 * Thin wrapper over S3-compatible storage. The bucket is private: nothing is public, and the
 * app only ever receives short-lived signed URLs. Callers store object keys, never URLs.
 */

const s3 = new S3Client({
  endpoint: env.AWS_ENDPOINT_URL_S3,
  region: env.AWS_REGION,
  forcePathStyle: true, // required by Neon's S3 endpoint
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
});

/** How long a signed read URL stays valid. Clients cache images by key, not by URL. */
const READ_URL_TTL_SECONDS = 60 * 60;

export const storageService = {
  async put(key: string, body: Buffer, contentType: string) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'private, max-age=86400',
      }),
    );
  },

  /** Best effort: a leftover object is harmless, so a failed delete never fails the request. */
  async remove(key: string) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    } catch (err) {
      console.warn('[storage] delete failed for', key, err instanceof Error ? err.message : err);
    }
  },

  signedReadUrl(key: string): Promise<string> {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
      expiresIn: READ_URL_TTL_SECONDS,
    });
  },
};
