import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** A health report ready to upload: a PDF as-is, or an image compressed like a photo. */
export interface Report {
  mimeType: 'application/pdf' | 'image/jpeg';
  base64: string;
  name: string;
}

/** The server takes ~1 MB of file (its JSON limit is 2 MB with base64 overhead). */
const MAX_BYTES = 1_000_000;

export class ReportTooBigError extends Error {
  constructor() {
    super('That file is over 1 MB. Try a photo of the page instead.');
  }
}

/** Opens the file picker for a PDF or an image. Null when cancelled. */
export async function pickReport(): Promise<Report | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  if (asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf')) {
    if ((asset.size ?? 0) > MAX_BYTES) throw new ReportTooBigError();
    return {
      mimeType: 'application/pdf',
      base64: await new File(asset.uri).base64(),
      name: asset.name,
    };
  }
  // Images: resized so small text stays readable but the upload stays small.
  const image = await ImageManipulator.manipulate(asset.uri).resize({ width: 1400 }).renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  if (!saved.base64) return null;
  return { mimeType: 'image/jpeg', base64: saved.base64, name: asset.name };
}
