/**
 * HTML Image Gallery Extraction Utility
 * Detects image galleries in HTML content and extracts image URLs
 */

export interface ImageGalleryInfo {
    id: string;
    name: string;
    imageCount: number;
    images: ExtractedImage[];
    source: 'gallery' | 'page';
}

export interface ExtractedImage {
    url: string;
    alt: string;
    width?: number;
    height?: number;
    filename: string;
}

/**
 * Extract all images from HTML content
 */
export function extractImagesFromHtml(html: string, baseUrl?: string): ExtractedImage[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: ExtractedImage[] = [];
    const seenUrls = new Set<string>();

    // Find all img tags
    const imgElements = doc.querySelectorAll('img');
    imgElements.forEach((img, index) => {
        let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (!src) return;

        // Make absolute URL if needed
        if (src.startsWith('//')) {
            src = 'https:' + src;
        } else if (src.startsWith('/') && baseUrl) {
            const url = new URL(baseUrl);
            src = url.origin + src;
        } else if (!src.startsWith('http') && baseUrl) {
            src = new URL(src, baseUrl).href;
        }

        // Skip data URLs and duplicates
        if (src.startsWith('data:') || seenUrls.has(src)) return;
        seenUrls.add(src);

        // Extract filename from URL
        const urlPath = src.split('?')[0];
        const filename = urlPath.split('/').pop() || `image_${index + 1}.jpg`;

        images.push({
            url: src,
            alt: img.getAttribute('alt') || '',
            width: img.naturalWidth || parseInt(img.getAttribute('width') || '0'),
            height: img.naturalHeight || parseInt(img.getAttribute('height') || '0'),
            filename
        });
    });

    return images;
}

/**
 * Detect image galleries in HTML (grouped images)
 */
export function detectImageGalleries(html: string, baseUrl?: string): ImageGalleryInfo[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const galleries: ImageGalleryInfo[] = [];

    // Common gallery container selectors
    const gallerySelectors = [
        '.gallery', '.image-gallery', '.photo-gallery', '.slider',
        '.carousel', '.swiper', '[data-gallery]', '.lightbox',
        '.grid', '.masonry', '.thumbnails', '.portfolio'
    ];

    // Check each potential gallery
    gallerySelectors.forEach((selector, gIndex) => {
        const containers = doc.querySelectorAll(selector);
        containers.forEach((container, cIndex) => {
            const images = container.querySelectorAll('img');
            if (images.length >= 3) { // At least 3 images to be considered a gallery
                const extractedImages: ExtractedImage[] = [];
                const seenUrls = new Set<string>();

                images.forEach((img, imgIndex) => {
                    let src = img.getAttribute('src') || img.getAttribute('data-src');
                    if (!src || src.startsWith('data:') || seenUrls.has(src)) return;

                    // Make absolute URL
                    if (src.startsWith('//')) src = 'https:' + src;
                    else if (src.startsWith('/') && baseUrl) src = new URL(baseUrl).origin + src;
                    else if (!src.startsWith('http') && baseUrl) src = new URL(src, baseUrl).href;

                    seenUrls.add(src);
                    const filename = src.split('?')[0].split('/').pop() || `image_${imgIndex + 1}.jpg`;

                    extractedImages.push({
                        url: src,
                        alt: img.getAttribute('alt') || '',
                        filename
                    });
                });

                if (extractedImages.length >= 3) {
                    galleries.push({
                        id: `gallery_${gIndex}_${cIndex}`,
                        name: container.getAttribute('id') ||
                            container.getAttribute('class')?.split(' ')[0] ||
                            `Gallery ${galleries.length + 1}`,
                        imageCount: extractedImages.length,
                        images: extractedImages,
                        source: 'gallery'
                    });
                }
            }
        });
    });

    // If no galleries found, treat all page images as a single gallery
    if (galleries.length === 0) {
        const allImages = extractImagesFromHtml(html, baseUrl);
        if (allImages.length > 0) {
            galleries.push({
                id: 'page_images',
                name: 'All Page Images',
                imageCount: allImages.length,
                images: allImages,
                source: 'page'
            });
        }
    }

    return galleries;
}

/**
 * Download images as ZIP (using JSZip)
 */
export async function downloadImagesAsZip(
    images: ExtractedImage[],
    zipName: string,
    onProgress?: (current: number, total: number) => void
): Promise<Blob> {
    // Dynamic import JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    let completed = 0;
    const total = images.length;

    // Download each image
    const downloadPromises = images.map(async (image, index) => {
        try {
            const response = await fetch(image.url, { mode: 'cors' });
            if (!response.ok) throw new Error(`Failed to fetch ${image.url}`);

            const blob = await response.blob();

            // Ensure unique filename
            let filename = image.filename;
            const ext = filename.split('.').pop() || 'jpg';
            const baseName = filename.replace(/\.[^.]+$/, '');
            filename = `${String(index + 1).padStart(3, '0')}_${baseName}.${ext}`;

            zip.file(filename, blob);
            completed++;
            onProgress?.(completed, total);
        } catch (error) {
            console.warn(`Failed to download image: ${image.url}`, error);
            completed++;
            onProgress?.(completed, total);
        }
    });

    await Promise.all(downloadPromises);

    // Generate ZIP
    return await zip.generateAsync({ type: 'blob' });
}

/**
 * Trigger download of a blob
 */
export function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get gallery summary for display
 */
export function getGallerySummary(galleries: ImageGalleryInfo[]): {
    totalGalleries: number;
    totalImages: number;
    hasGalleries: boolean;
} {
    const totalImages = galleries.reduce((sum, g) => sum + g.imageCount, 0);
    return {
        totalGalleries: galleries.length,
        totalImages,
        hasGalleries: galleries.length > 0 && totalImages > 0
    };
}
