import express from 'express';
import { fetchGCSFiles } from '../controllers/mainController';

const router = express.Router();

router.get('/fetch', fetchGCSFiles);

export default router;
