import express from 'express';
import { optimizeComponents, getOptimizedComponent } from '../controllers/mainController';

const router = express.Router();

router.get('/optimize', optimizeComponents);
router.get('/optimized/:id', getOptimizedComponent);

export default router;
