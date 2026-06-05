// Pure image-upload validation rules for the Submit flow. Separated from
// imageCheck.js (which imports the Supabase client and uses browser-only
// `Image`/`URL.createObjectURL`) so the constraint logic can be unit-tested
// with plain objects — no DOM, no network.

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MIN_IMAGE_WIDTH = 200;
export const MIN_IMAGE_HEIGHT = 100;
export const MAX_IMAGE_DIMENSION = 6000;

// Validate the type + size of a file-like object ({ type, size }). Dimension
// checks are optional (pass width/height once measured) so callers can run the
// cheap checks before paying for image decoding.
//
// Returns a list of human-readable error strings; empty means valid.
/**
 * @param {{ type?: string, size?: number, width?: number, height?: number }} [input]
 * @returns {string[]}
 */
export function validateImageConstraints({ type, size, width, height } = {}) {
  const errors = [];

  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    errors.push("File must be JPG, PNG, WebP or GIF");
  }

  if (typeof size === "number" && size > MAX_IMAGE_BYTES) {
    errors.push("File must be under 5MB");
  }

  if (typeof width === "number" && typeof height === "number") {
    if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
      errors.push("Image must be at least 200x100 pixels");
    }
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      errors.push("Image is too large. Max 6000x6000 pixels");
    }
  }

  return errors;
}
