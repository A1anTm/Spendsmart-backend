import express from 'express';
import { listCategories } from '../controllers/categoryController.js';

const router = express.Router();
router.post('/', listCategories);   
export default router;