import express from 'express';
import { reconstructHtml } from '../controllers/mainController';

const router = express.Router();

router.get('/build', reconstructHtml);

export default router;
