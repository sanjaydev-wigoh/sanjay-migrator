import express from 'express';
import { convertHtmlToJson } from '../controllers/mainController';

const router = express.Router();

router.get('/convert', convertHtmlToJson);

export default router;
