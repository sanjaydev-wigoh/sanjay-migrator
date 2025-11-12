import express from 'express';
import { processHtmlWithStyles } from '../controllers/mainController';

const router = express.Router();

router.get('/process', processHtmlWithStyles);

export default router;
