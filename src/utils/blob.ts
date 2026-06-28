/**
 * Encodes a Blob as a base64 `data:` URL (mime type preserved).
 * Used to embed binary thumbnails inside JSON export bundles.
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes a `data:` URL produced by {@link blobToDataURL} back into a Blob.
 * Relies on the browser's native data-URL handling via `fetch`.
 */
export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const res = await fetch(dataURL);
  return res.blob();
}
