import mongoose from 'mongoose';
import validator from 'validator';

/**
 * Presupuesto de una categoría en un mes
 * 
 * Atributos
 * ----------
 * user_id     : ObjectId (ref: User)  – Usuario propietario del presupuesto.
 * category_id : ObjectId (ref: Category) – Categoría que se controla.
 * month       : String (AAAA-MM)      – Mes calendario al que aplica el presupuesto.
 * limit       : Decimal128            – Cantidad máxima que puede gastarse en ese mes y categoría.
 * threshold   : Number (0-100)        – Porcentaje sobre el límite que, al alcanzarse, genera alerta.
 * isActive    : Boolean               – true  → presupuesto vigente.
 *                                     – false → presupuesto desactivado (soft-delete lógico).
 * isDeleted   : Boolean               – true  → registro marcado como eliminado (soft-delete).
 * createdAt   : Date (automático)     – Fecha y hora de creación del registro.
 * updatedAt   : Date (automático)     – Fecha y hora de la última modificación.
 */
const budgetSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es obligatorio'],
    index: true
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'La categoría es obligatoria']
  },
  month: {
    type: String,
    required: [true, 'El mes es obligatorio'],
    match: [/^\d{4}-\d{2}$/, 'El mes debe tener formato AAAA-MM'],
    validate: {
      validator(v) {
        const [y, m] = v.split('-').map(Number);
        return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
      },
      message: 'Mes fuera de rango'
    }
  },
  limit: {
    type: mongoose.Types.Decimal128,
    required: [true, 'El límite es obligatorio'],
    validate: {
      validator(v) {
        return validator.isFloat(v.toString(), { min: 0.01 });
      },
      message: 'El límite debe ser mayor a 0'
    }
  },
  threshold: {
    type: Number,
    required: [true, 'El umbral es obligatorio'],
    min: [0, 'El umbral no puede ser menor a 0'],
    max: [100, 'El umbral no puede ser mayor a 100']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true });

budgetSchema.index({ user_id: 1, category_id: 1, month: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);