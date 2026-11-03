/**
 * uploadAvatar.ts
 *
 * A link in the chain for exactly one route, PUT /api/users/me/avatar. JSON
 * cannot carry a file, so the client sends multipart/form-data instead, and
 * multer reads it. It leaves the image's bytes in req.file.buffer (memory
 * storage, since they go straight into PostgreSQL), or passes on an error if the
 * file is too large or not an image we accept.
 */
import multer from 'multer';
import { AVATAR_TYPES, MAX_AVATAR_BYTES } from '@wolfie-lists/shared';
import { HttpError } from './errorHandlers';

export const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
    fileFilter(_req, file, accept) {
        if (AVATAR_TYPES.includes(file.mimetype)) {
            accept(null, true);
        } else {
            accept(new HttpError(400, 'An avatar must be a PNG, JPEG or WebP image.'));
        }
    }
}).single('avatar');
