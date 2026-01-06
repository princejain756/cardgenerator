/**
 * Image compression utility
 * Compresses images to be under a target size (default 200KB)
 */

const MAX_SIZE_BYTES = 200 * 1024; // 200KB
const MAX_DIMENSION = 800; // Max width/height for ID card images
const INITIAL_QUALITY = 0.9;
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.1;

/**
 * Compress an image file to be under the target size
 * @param file - The image file to compress
 * @param maxSizeBytes - Maximum file size in bytes (default 200KB)
 * @returns Promise<string> - Base64 data URL of compressed image
 */
export async function compressImage(
    file: File,
    maxSizeBytes: number = MAX_SIZE_BYTES
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                try {
                    const result = compressToTargetSize(img, maxSizeBytes);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Compress image to target size using canvas
 */
function compressToTargetSize(img: HTMLImageElement, maxSizeBytes: number): string {
    // Calculate dimensions while maintaining aspect ratio
    let { width, height } = img;

    // Resize if larger than max dimension
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
        } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
        }
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // Draw image with white background (for transparency)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Try different quality levels until we're under the target size
    let quality = INITIAL_QUALITY;
    let result = canvas.toDataURL('image/jpeg', quality);

    while (getBase64Size(result) > maxSizeBytes && quality > MIN_QUALITY) {
        quality -= QUALITY_STEP;
        result = canvas.toDataURL('image/jpeg', quality);
    }

    // If still too large, reduce dimensions further
    if (getBase64Size(result) > maxSizeBytes) {
        const scale = 0.7;
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL('image/jpeg', MIN_QUALITY);
    }

    console.log(`Image compressed: ${(getBase64Size(result) / 1024).toFixed(1)}KB (quality: ${quality.toFixed(1)})`);

    return result;
}

/**
 * Get size of base64 string in bytes
 */
function getBase64Size(base64: string): number {
    // Remove data URL prefix
    const base64Data = base64.split(',')[1] || base64;
    // Calculate size (base64 is ~4/3 of original size)
    return Math.round((base64Data.length * 3) / 4);
}

/**
 * Check if a file needs compression
 */
export function needsCompression(file: File): boolean {
    return file.size > MAX_SIZE_BYTES;
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
