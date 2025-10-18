import express from 'express';
import { createSavingsGoal, getUserGoals, updateSavingsGoal, deleteSavingsGoal, addMoneyToGoal } from "../controllers/savingsGoalsController.js";
import { isAuth } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', isAuth, createSavingsGoal);        
router.get('/', isAuth, getUserGoals);              
router.put('/:id', isAuth, updateSavingsGoal);      
router.patch('/:id/add-money', isAuth, addMoneyToGoal); 
router.delete('/:id', isAuth, deleteSavingsGoal);   

export default router;
