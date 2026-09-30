import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');

// Ensure destination directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.webp';
    const uniqueId = crypto.randomUUID ? crypto.randomUUID().slice(0, 10) : Math.random().toString(36).slice(2, 12);
    const safeName = `product_${Date.now()}_${uniqueId}${safeExt}`;
    cb(null, safeName);
  },
});

export const productUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Invalid image format. Allowed formats: PNG, JPG/JPEG, WEBP (Max 5MB).'));
    }
    cb(null, true);
  },
});

/**
 * Safely removes a file from /uploads/products if it was an uploaded file
 */
export function deleteUploadedImage(imageUrl?: string | null): void {
  if (!imageUrl || !imageUrl.startsWith('/uploads/products/')) {
    return; // Don't delete system repository assets
  }

  try {
    const relativePath = imageUrl.replace(/^\//, '');
    const fullPath = path.join(process.cwd(), 'public', relativePath);
    // Security check: ensure path is strictly within UPLOAD_DIR
    if (fullPath.startsWith(UPLOAD_DIR) && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn(`Could not safely delete uploaded image ${imageUrl}:`, err);
  }
}
