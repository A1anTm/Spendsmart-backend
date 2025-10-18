import express from 'express';
import {createBudget, listBudgets, toggleBudget, deleteBudget} from "../controllers/budgetsController.js";
import { isAuth } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', isAuth, createBudget);                 
router.get('/', isAuth, listBudgets);                   
router.patch('/:id/toggle', isAuth, toggleBudget);      
router.delete('/:id', isAuth, deleteBudget);            

export default router;