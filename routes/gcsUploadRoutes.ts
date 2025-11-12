import express from 'express';
import { uploadJsonToGcs } from '../controllers/mainController';

const router = express.Router();

router.get('/upload', uploadJsonToGcs);

export default router;
