import { supabase } from './supabase';

/**
 * Upload a file/buffer to a specific Supabase storage bucket
 * @param bucketName The name of the storage bucket
 * @param path The destination path inside the bucket (e.g. 'avatars/student1.png')
 * @param fileBody The body content of the file (Blob, ArrayBuffer, File, etc.)
 * @param contentType Optional content-type header (e.g. 'image/png')
 */
export async function uploadFile(
  bucketName: string,
  path: string,
  fileBody: any,
  contentType?: string
) {
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Please verify your environment keys.');
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(path, fileBody, {
      upsert: true,
      contentType,
    });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get the public URL for a file inside a bucket
 * @param bucketName The name of the storage bucket
 * @param path The path to the file within the bucket
 */
export function getPublicUrl(bucketName: string, path: string): string {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file or list of files from a bucket
 * @param bucketName The name of the storage bucket
 * @param paths A path or array of paths to delete within the bucket
 */
export async function deleteFiles(bucketName: string, paths: string | string[]) {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  const pathsArray = Array.isArray(paths) ? paths : [paths];
  const { data, error } = await supabase.storage.from(bucketName).remove(pathsArray);

  if (error) {
    throw error;
  }

  return data;
}
