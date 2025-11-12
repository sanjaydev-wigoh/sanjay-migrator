import express from 'express';
import { extractWidgets } from '../controllers/mainController';

const router = express.Router();

router.get('/extract', extractWidgets);

export default router;
