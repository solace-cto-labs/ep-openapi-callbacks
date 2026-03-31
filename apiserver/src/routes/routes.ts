import { Router } from 'express';
import callbacks from '../controllers/callbacks.js';

const router = Router();

router.post('/*splat', callbacks.subscribe);
router.delete('/*splat', callbacks.unsubscribe);


export default router;