import SavingsGoal from '../models/savingsGoalsModel.js';
import mongoose from 'mongoose';
import { createTransaction } from './transactionsController.js';
import Category from "../models/categoryModel.js";

const toNumber = d => parseFloat(d.toString());

function getMonthlyQuota(target, current, dueDate) {
    const now = new Date();
    const diffMonths = Math.max(0, (dueDate.getFullYear() - now.getFullYear()) * 12 + (dueDate.getMonth() - now.getMonth()));
    const remaining = target - current;
    return diffMonths === 0 ? remaining : remaining / (diffMonths + 1);
}

function parseDateOnly(input) {
    // Acepta 'YYYY-MM-DD' o Date | ISO string; devuelve Date en midnight local (hours 0,0,0,0) o null si inválida
    if (!input) return null;
    try {
        if (typeof input === 'string') {
            // si viene en formato YYYY-MM-DD (desde <input type="date">)
            const isoDateMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoDateMatch) {
                const y = Number(isoDateMatch[1]);
                const m = Number(isoDateMatch[2]);
                const d = Number(isoDateMatch[3]);
                return new Date(y, m - 1, d); // constructor local
            }
            // fallback: intentar parsear cualquier string
            const dt = new Date(input);
            if (!isNaN(dt.getTime())) {
                return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
            }
            return null;
        } else if (input instanceof Date) {
            if (isNaN(input.getTime())) return null;
            return new Date(input.getFullYear(), input.getMonth(), input.getDate());
        } else {
            // otros tipos -> invalid
            return null;
        }
    } catch (e) {
        return null;
    }
}

export const createSavingsGoal = async (req, res) => {
    try {
        const { name, description, target_amount, due_date } = req.body;

        // parsear fecha a midnight local
        const dueDate = parseDateOnly(due_date);

        // log de depuración (quítalo en producción si quieres)
        console.log('📅 createSavingsGoal - payload due_date:', due_date, ' -> parsed dueDate:', dueDate);

        if (!dueDate) {
            return res.status(400).json({ message: 'Fecha límite inválida' });
        }

        const exists = await SavingsGoal.findOne({
            user_id: req.user._id,
            name: name.trim(),
            isDeleted: false
        });
        if (exists) return res.status(409).json({ message: 'Ya tienes una meta con ese nombre.' });

        const goal = await SavingsGoal.create({
            user_id: req.user._id,
            name: name.trim(),
            description: description || '',
            target_amount,
            due_date: dueDate, // guardamos fecha normalizada (midnight local)
            current_amount: 0
        });

        return res.status(201).json({ goal });
    } catch (e) {
        console.error('Error al crear meta de ahorro ->', e);
        return res.status(500).json({ message: 'Error al crear meta de ahorro' });
    }
};

export const getUserGoals = async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ user_id: req.user._id, isDeleted: false }).lean();

        const enriched = goals.map(g => {
        const target = toNumber(g.target_amount);
        const current = toNumber(g.current_amount);
        const progress = target ? Math.min(100, (current / target) * 100) : 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(g.due_date);
        due.setHours(0, 0, 0, 0);

        const status = today > due ? 'vencida' : 'activa';
        const monthlyQuota = getMonthlyQuota(target, current, due);

        return {
            _id: g._id,
            name: g.name,
            description: g.description,
            target_amount: target,
            current_amount: current,
            due_date: g.due_date,
            status,
            progress: parseFloat(progress.toFixed(2)),
            monthly_quota: parseFloat(monthlyQuota.toFixed(2))
        };
        });

        return res.json({ goals: enriched });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: 'Error al obtener metas' });
    }
    };

export const updateSavingsGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const goal = await SavingsGoal.findOneAndUpdate(
            { _id: id, user_id: req.user._id, isDeleted: false },
            req.body,
            { new: true, runValidators: true }
        );
        if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
        return res.json({ goal });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: 'Error al actualizar meta' });
    }
};

export const deleteSavingsGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const goal = await SavingsGoal.findOneAndUpdate(
            { _id: id, user_id: req.user._id, isDeleted: false },
            { isDeleted: true },
            { new: true }
        );
        if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
        return res.json({ message: 'Meta eliminada' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: 'Error al eliminar meta' });
    }
};

    export const addMoneyToGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const raw = req.body.amount;

        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Monto inválido' });
        }

        const goal = await SavingsGoal.findOne({
        _id: id,
        user_id: req.user._id,
        isDeleted: false
        });
        if (!goal) {
        return res.status(404).json({ message: 'Meta no encontrada' });
        }

        const current = parseFloat(goal.current_amount.toString());
        const target = parseFloat(goal.target_amount.toString());
        const newCurrent = Math.min(current + amount, target);

        const CATEGORY_NAME = 'Otros';
        const CATEGORY_TYPE = 'gasto';

        let category = await Category.findOne({ name: CATEGORY_NAME, appliesTo: CATEGORY_TYPE });

        if (!category) {
        category = await Category.create({ name: CATEGORY_NAME, appliesTo: CATEGORY_TYPE });
        }

        const fakeReq = {
        user: req.user,
        body: {
            type: 'gasto',
            amount,
            date: new Date(),
            category_id: category._id.toString(),
            description: 'Meta de ahorro'
        }
        };

        let capturedStatus = 201;
        let capturedJson = { message: '' };

        const fakeRes = {
        status: (code) => {
            capturedStatus = code;
            return { json: (obj) => { capturedJson = obj; } };
        }
        };

        await createTransaction(fakeReq, fakeRes);

        if (capturedStatus !== 201) {
        return res.status(capturedStatus).json(capturedJson);
        }

        goal.current_amount = newCurrent;
        await goal.save();

        return res.json({
        message: 'Dinero agregado',
        goal: {
            _id: goal._id,
            name: goal.name,
            current_amount: newCurrent,
            target_amount: target,
            completed: newCurrent >= target
        }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: 'Error al abonar a la meta' });
    }
    };
