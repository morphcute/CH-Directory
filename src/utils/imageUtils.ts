/**
 * Utility to process and compress an uploaded banner image file on the client
 * so that it stays lightweight, fast-loading, and safe for localStorage.
 */
export const compressImageFile = (
  file: File,
  maxWidth = 1600,
  maxHeight = 800,
  quality = 0.86
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  originalName: string;
  sizeKb: number;
}> => {
  return new Promise((resolve, reject) => {
    // Validate that it is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale if oversized
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas rendering context not available'));
          return;
        }

        // Draw image smoothly on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP if supported, fallback to JPEG
        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Estimate size in KB
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

        resolve({
          dataUrl,
          width,
          height,
          originalName: file.name,
          sizeKb,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
