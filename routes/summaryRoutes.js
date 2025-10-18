import express from 'express';
import { getMonthlySummary } from '../controllers/summaryController.js';
import { isAuth } from '../middlewares/auth.js';

const router = express.Router();
router.get('/', isAuth, getMonthlySummary);
export default router;