import { supabase } from './supabase';

/**
 * Convert a local file URI (file://, content://, ph://, blob:) into an ArrayBuffer
 * for seamless React Native compatibility with Supabase storage upload.
 */
export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
      } else {
        reject(new Error(`XHR failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = function (e) {
      reject(new TypeError(`Network request failed reading file URI: ${uri}`));
    };
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

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
 * Upload a local file URI (or remote URL) directly to Supabase storage.
 * Automatically handles ArrayBuffer conversion for React Native compatibility.
 */
export async function uploadFileFromUri(
  bucketName: string,
  path: string,
  fileUri: string,
  contentType: string = 'image/jpeg'
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  let fileBody: any;
  if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
    const res = await fetch(fileUri);
    fileBody = await res.arrayBuffer();
  } else {
    fileBody = await uriToArrayBuffer(fileUri);
  }

  await uploadFile(bucketName, path, fileBody, contentType);
  return getPublicUrl(bucketName, path);
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

/**
 * Create a temporary signed URL to download or view a private file in storage
 * @param bucketName The name of the storage bucket
 * @param path The path to the file within the bucket
 * @param expiresInSeconds Duration in seconds before the signed URL expires (default: 3600 = 1 hour)
 */
export async function createSignedUrl(
  bucketName: string,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error || new Error('Failed to generate signed URL.');
  }

  return data.signedUrl;
}

