/**
 * listRoutes.ts
 *
 * Which controller function answers which URL. app.ts mounts this router at
 * /api/lists, behind authenticate, so '/' here means /api/lists and every one
 * of these routes already knows who is asking.
 */
import { Router } from 'express';
import {
    createList,
    deleteList,
    duplicateList,
    getAllMetadata,
    getList,
    updateList
} from '../controllers/listController';

const router = Router();

router.get('/', getAllMetadata);
router.post('/', createList);
router.get('/:id', getList);
router.put('/:id', updateList);
router.delete('/:id', deleteList);
router.post('/:id/duplicate', duplicateList);

export default router;
