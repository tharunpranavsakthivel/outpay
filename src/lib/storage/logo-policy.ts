/**
 * Defines the content-type policy for merchant logo uploads.
 *
 * This module is dependency-free so upload validation can be tested without
 * initializing the object-storage client or requiring runtime credentials.
 */

export const ALLOWED_LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Checks whether a browser-provided logo MIME type is safe for storage and
 * public raster-image serving.
 *
 * Parameters:
 * - contentType: MIME type supplied by the uploaded `File`.
 *
 * Returns:
 * - `true` for supported raster image types; `false` for SVG and all other
 *   types, including missing or spoofed values.
 */
export function isAllowedLogoContentType(contentType: string): boolean {
  return ALLOWED_LOGO_CONTENT_TYPES.has(contentType);
}
