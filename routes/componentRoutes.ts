import express from 'express';
import { extractComponents } from '../controllers/mainController';

const router = express.Router();

router.get('/extract', extractComponents);

export default router;
