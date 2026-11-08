import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** A photo ready to upload: compressed JPEG as base64. */
export interface Photo {
  mimeType: 'image/jpeg';
  base64: string;
}

export type PhotoSource = 'camera' | 'library';

export class PhotoPermissionError extends Error {
  constructor(readonly source: PhotoSource) {
    super(
      source === 'camera'
        ? 'Camera access is off. Allow it in Settings, or choose a photo instead.'
        : 'Photo access is off. Allow it in Settings to choose a photo.',
    );
  }
}

interface Options {
  /** Longest edge after resizing. */
  maxSize: number;
  /** 0–1 JPEG quality. */
  quality: number;
  /** Let the user crop to a square (profile photos). */
  square?: boolean;
}

/**
 * Takes or picks a photo and returns it resized + compressed, ready to upload.
 * Returns null if the user cancels; throws PhotoPermissionError if access is denied.
 */
export async function pickPhoto(
  source: PhotoSource,
  { maxSize, quality, square }: Options,
): Promise<Photo | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PhotoPermissionError(source);

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    ...(square && { allowsEditing: true, aspect: [1, 1] }),
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > maxSize) {
    context.resize(asset.width >= asset.height ? { width: maxSize } : { height: maxSize });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: quality, format: SaveFormat.JPEG });
  return saved.base64 ? { mimeType: 'image/jpeg', base64: saved.base64 } : null;
}

/** Proof photos: big enough for the AI to see clearly, small enough to upload fast. */
export const PROOF_PHOTO = { maxSize: 768, quality: 0.6 } as const;
/** Profile photos: square, 512px is plenty for every avatar size in the app. */
export const AVATAR_PHOTO = { maxSize: 512, quality: 0.7, square: true } as const;
