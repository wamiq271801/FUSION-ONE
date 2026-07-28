import type { SendMediaInput } from './types';

const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
export function prepareMedia(input: SendMediaInput) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUri);
  if (!match) throw new Error('Media must be a base64 data URI');
  if (match[1] !== input.mimeType) throw new Error('Media MIME type does not match its payload');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new Error('Media must be between 1 byte and 16 MB');
  return { buffer, mimeType: input.mimeType, fileName: input.fileName?.replace(/[^\w. -]/g, '_').slice(0, 120) || 'attachment', caption: input.caption?.slice(0, 4096) };
}
