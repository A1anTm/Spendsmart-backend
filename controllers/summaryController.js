import Transaction from '../models/transactionsModel.js';
import SavingsGoal from '../models/savingsGoalsModel.js';
import mongoose from 'mongoose';

const EMPTY_GOAL = {
  name: 'Sin metas activas'
};

export const getMonthlySummary = async (req, res) => {
  try {
    const { month } = req.query; 
    if (!month) return res.status(400).json({ message: 'Falta month' });

    const [year, mm] = month.split('-').map(Number);
    const start = new Date(year, mm - 1, 1);
    const end   = new Date(year, mm, 1);
    const userId = req.user._id;

    console.log('Mes consultado:', month);
    console.log('Rango:', start, 'a', end);

    const incomeAgg = await Transaction.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), type: 'ingreso', date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
    ]);
    const expenseAgg = await Transaction.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), type: 'gasto', date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
    ]);

    const monthlyIncome  = incomeAgg.length  ? incomeAgg[0].total  : 0;
    const monthlyExpense = expenseAgg.length ? expenseAgg[0].total : 0;
    const monthlySavings = monthlyIncome - monthlyExpense;

    const totalIncome = await Transaction.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), type: 'ingreso' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
    ]);
    const totalExpense = await Transaction.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), type: 'gasto' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
    ]);
    const totalBalance = (totalIncome.length ? totalIncome[0].total : 0) -
                        (totalExpense.length ? totalExpense[0].total : 0);

    const recent = await Transaction.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $sort: { created_at: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'cat'
        }
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          type: 1,
          amount: { $toDouble: '$amount' },
          name: { $ifNull: ['$cat.name', 'Sin categoría'] },
          createdAt: '$created_at',
          updatedAt: '$updated_at'
        }
      }
    ]);

    const savedInGoals = await SavingsGoal.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), isDeleted: false } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$current_amount' } } } }
    ]);
    const totalSaved = savedInGoals.length ? savedInGoals[0].total : 0;

    const closestGoalAgg = await SavingsGoal.aggregate([
      { $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          due_date: { $gte: new Date() }
      }},
      { $addFields: {
          progress: {
            $divide: [
              { $toDouble: '$current_amount' },
              { $toDouble: '$target_amount' }
            ]
          }
      }},
      { $sort: { progress: -1 } },
      { $limit: 1 },
      { $project: {
          _id: 1,
          name: 1,
          description: 1,
          target_amount: { $toDouble: '$target_amount' },
          current_amount: { $toDouble: '$current_amount' },
          progress: 1,
          due_date: 1
      }}
    ]);

    const closestGoal = closestGoalAgg.length ? closestGoalAgg[0] : EMPTY_GOAL;

    return res.json({
      totalBalance,
      monthlyIncome,
      monthlyExpense,
      monthlySavings,
      totalSaved,
      recentTransactions: recent,
      closestGoal
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Error al generar resumen' });
  }
};