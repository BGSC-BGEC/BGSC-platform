/** Feedback accepts links, not public gallery uploads containing private support evidence. */
export function attachmentUrls(text: string): string[] {
  const links = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (links.length > 5) throw new Error('Add up to five attachment links.');
  for (const link of links) {
    let valid = false;
    try {
      const url = new URL(link);
      valid = ['http:', 'https:'].includes(url.protocol) && link.length <= 500;
    } catch { /* Invalid URLs receive the same field guidance. */ }
    if (!valid) throw new Error('Each attachment must be a full http or https link, up to 500 characters.');
  }
  return links;
}

export function mediaUploadError(mime: string, size?: number): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(mime)) {
    return 'Choose a JPG, PNG, WebP, MP4 or WebM file. Convert HEIC photos and MOV videos before uploading.';
  }
  if (size != null && size > (mime.startsWith('image/') ? 10 : 50) * 1024 * 1024) {
    return mime.startsWith('image/') ? 'Photos must be 10 MB or smaller.' : 'Videos must be 50 MB or smaller.';
  }
  return null;
}
