/**
 * userRoutes.ts
 *
 * Mounted at /api/users, behind authenticate. Note the avatar upload: a route
 * can have middleware of its own, so uploadAvatar is a link in the chain for
 * this one route only, and runs before setAvatar does.
 */
import { Router } from 'express';
import { changePassword, getAvatar, getMe, setAvatar } from '../controllers/userController';
import { uploadAvatar } from '../middleware/uploadAvatar';

const router = Router();

router.get('/me', getMe);
router.put('/me/password', changePassword);
router.get('/me/avatar', getAvatar);
router.put('/me/avatar', uploadAvatar, setAvatar);

export default router;
