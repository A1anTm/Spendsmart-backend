// controllers/budgetsController.js
import Budget from "../models/budgetsModel.js";
import Transaction from "../models/transactionsModel.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import dotenv from "dotenv";
import { sendMail } from "../utils/mailer.js";

dotenv.config();

const toNumber = (d) => parseFloat(d.toString());

/**
 * Calcula gastado en el "month" indicado (formato "YYYY-MM").
 * Si budgetCreatedAt se pasa y cae dentro del mes, el intervalo comienza
 * desde budgetCreatedAt (normalizado al inicio del día) en lugar del 1 del mes.
 *
 * @param {String} userId
 * @param {String} catId
 * @param {String} month - "YYYY-MM"
 * @param {String|Date|null} budgetCreatedAt - optional
 * @returns {Number} suma de amount (Number)
 */
async function spentInPeriod(userId, catId, month, budgetCreatedAt = null) {
  const [year, mm] = month.split('-').map(Number);
  // inicio y fin del mes (UTC-local JS Date objects)
  let start = new Date(year, mm - 1, 1);
  const end = new Date(year, mm, 1);

  // Si nos pasaron createdAt del presupuesto y cae dentro de este mes,
  // arrancamos desde la fecha de creación EXACTA (no desde inicio del día)
  if (budgetCreatedAt) {
    try {
      const created = new Date(budgetCreatedAt);
      if (!isNaN(created.getTime()) && created >= start && created < end) {
        start = created; // <-- usamos el timestamp exacto del createdAt
      }
    } catch (e) {
      console.warn('[spentInPeriod] parsing budgetCreatedAt falló:', e && e.message ? e.message : e);
    }
  }

  const agg = await Transaction.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        category_id: new mongoose.Types.ObjectId(catId),
        type: 'gasto',
        date: { $gte: start, $lt: end }
      }
    },
    { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
  ]);

  return agg.length ? agg[0].total : 0;
}

export const createBudget = async (req, res) => {
  try {
    const { category_id, month, limit, threshold } = req.body;

    const activeCount = await Budget.countDocuments({
      user_id: req.user._id,
      isActive: true,
      isDeleted: false,
    });
    if (activeCount >= 10) {
      return res.status(409).json({
        message:
          "Solo puedes tener hasta 10 presupuestos activos simultáneamente.",
      });
    }

    const updated = await Budget.findOneAndUpdate(
      {
        user_id: req.user._id,
        category_id,
        month,
      },
      {
        $set: {
          limit,
          threshold,
          isActive: true,
          isDeleted: false,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    // Nota: findOneAndUpdate con upsert devuelve el documento (sea nuevo o actualizado).
    return res.status(200).json({ budget: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al crear presupuesto" });
  }
};

export const listBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({
      user_id: req.user._id,
      isActive: true,
      isDeleted: false,
    })
      .populate("category_id", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const invalid = budgets.find((b) => !b.category_id);
    if (invalid) {
      return res.status(400).json({ message: "ID de categoría inválido" });
    }

    const enriched = await Promise.all(
      budgets.map(async (b) => {
        // PASAMOS b.createdAt para que el gasto empiece a contarse desde la creación del presupuesto
        const spent = await spentInPeriod(
          req.user._id,
          b.category_id._id,
          b.month,
          b.createdAt
        );
        const limitNum = toNumber(b.limit);
        const avail = limitNum - spent;
        const percent = limitNum
          ? ((spent / limitNum) * 100).toFixed(1)
          : "0.0";

        return {
          _id: b._id,
          category: b.category_id.name,
          month: b.month,
          limit: limitNum,
          threshold: b.threshold,
          isActive: b.isActive,
          spent,
          available: avail,
          percentUsed: parseFloat(percent),
          alert: b.isActive && b.threshold <= parseFloat(percent),
        };
      })
    );

    return res.json({ budgets: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al listar presupuestos" });
  }
};

export const toggleBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const bud = await Budget.findOne({
      _id: id,
      user_id: req.user._id,
      isDeleted: false,
    });

    if (!bud)
      return res.status(404).json({ message: "Presupuesto no encontrado" });

    bud.isActive = !bud.isActive;
    await bud.save();

    return res.json({
      budget: bud,
      message: bud.isActive
        ? "Presupuesto activado"
        : "Presupuesto desactivado",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al cambiar estado" });
  }
};

export const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await Budget.findOneAndUpdate(
      { _id: id, user_id: req.user._id, isDeleted: false },
      { isDeleted: true, isActive: false },
      { new: true }
    );

    if (!budget)
      return res.status(404).json({ message: "Presupuesto no encontrado" });

    return res.json({ message: "Presupuesto eliminado" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al eliminar" });
  }
};

export async function checkBudgetAlert(userId, categoryId, month) {
  try {
    console.log("[BUDGET-ALERT] Invocado:", { userId, categoryId, month });

    // populate para tener category_id.name
    const budget = await Budget.findOne({
      user_id: userId,
      category_id: categoryId,
      month,
      isActive: true,
      isDeleted: false,
    }).populate("category_id", "name");

    if (!budget) {
      console.log("[BUDGET-ALERT] No hay presupuesto para ese user/cat/mes");
      return;
    }
    console.log("[BUDGET-ALERT] Presupuesto encontrado:", {
      id: budget._id.toString(),
      limit: budget.limit.toString(),
      threshold: budget.threshold,
    });

    // PASAMOS budget.createdAt para respetar desde cuándo debe contarse
    const spent = await spentInPeriod(
      userId,
      categoryId,
      month,
      budget.createdAt
    );
    const limitNum = parseFloat(budget.limit.toString());
    const spentNum = parseFloat(spent.toString());
    const percentUsed = limitNum ? (spentNum / limitNum) * 100 : 0;

    console.log("[BUDGET-ALERT] Cálculo gasto:", {
      spentNum,
      limitNum,
      percentUsed,
    });

    if (percentUsed >= budget.threshold) {
      const user = await User.findById(userId);
      if (!user || !user.email) {
        console.log("[BUDGET-ALERT] Usuario sin email o inexistente:", userId);
        return;
      }

      const subject = "⚠️ Alerta de presupuesto";
      const html = `
        <p>Hola,</p>
        <p>Tu presupuesto para <strong>${
          budget.category_id?.name || "Categoría"
        }</strong> en <strong>${month}</strong> ha alcanzado el <strong>${percentUsed.toFixed(
        1
      )}%</strong> de su límite.</p>
        <p>Límite: $${limitNum.toFixed(2)}</p>
        <p>Gastado: $${spentNum.toFixed(2)}</p>
        <p>Te recomendamos revisar tus gastos.</p>
      `;

      const mailOptions = {
        from: `SpendSmart <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject,
        text: `Tu presupuesto para ${
          budget.category_id?.name || "Categoría"
        } en ${month} alcanzó ${percentUsed.toFixed(
          1
        )}%. Gastado: $${spentNum.toFixed(2)} / Límite: $${limitNum.toFixed(
          2
        )}`,
        html,
        envelope: { from: process.env.EMAIL_USER, to: user.email },
      };

      try {
        const info = await sendMail(mailOptions);
        console.log("[BUDGET-ALERT] Email enviado:", {
          accepted: info.accepted,
          rejected: info.rejected,
        });
      } catch (sendErr) {
        console.error(
          "[BUDGET-ALERT] Error al enviar email:",
          sendErr && sendErr.message ? sendErr.message : sendErr
        );
      }
    } else {
      console.log("[BUDGET-ALERT] Umbral no alcanzado:", {
        percentUsed,
        threshold: budget.threshold,
      });
    }
  } catch (error) {
    console.error(
      "[BUDGET-ALERT] Error:",
      error && error.message ? error.message : error
    );
  }
}
