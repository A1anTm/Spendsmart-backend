import mongoose from 'mongoose';
import validator from 'validator';
/**
 * Meta de ahorro personal del usuario
 *
 * Atributos
 * ----------
 * user_id        : ObjectId (ref: User, indexado) – Usuario propietario de la meta.
 * name           : String (trim) – Nombre corto descriptivo de la meta (ej. “Viaje a Japón”).
 * description    : String – Texto libre con detalles adicionales (opcional).
 * target_amount  : Decimal128 – Cantidad que se desea alcanzar.
 * current_amount : Decimal128 – Cantidad ahorrada hasta el momento (default 0).
 * due_date       : Date – Fecha límite para conseguir el objetivo.
 * isDeleted      : Boolean – true = meta eliminada (soft-delete); false = activa.
 * created_at     : Date (automático) – Fecha de creación del registro.
 * updated_at     : Date (automático) – Fecha de la última modificación.
 */
    const savingsGoalSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'El usuario es obligatorio'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true,
        minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
        maxlength: [60, 'El nombre no puede superar 60 caracteres'],
        match: [/^[a-zA-Z0-9áéíóúüñÑ\s'-]+$/, 'Caracteres no válidos en el nombre']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [250, 'La descripción no puede superar 250 caracteres']
    },
    target_amount: {
        type: mongoose.Types.Decimal128,
        required: [true, 'La cantidad objetivo es obligatoria'],
        validate: {
        validator(v) {
            return validator.isFloat(v.toString(), { min: 0.01 });
        },
        message: 'El objetivo debe ser mayor a 0'
        }
    },
    current_amount: {
        type: mongoose.Types.Decimal128,
        default: 0,
        validate: {
        validator(v) {
            return validator.isFloat(v.toString(), { min: 0 });
        },
        message: 'El monto actual no puede ser negativo'
        }
    },
    due_date: {
    type: Date,
    required: [true, 'La fecha límite es obligatoria'],
    validate: {
        validator(v) {
            try {
            const due = new Date(v);
            if (isNaN(due.getTime())) return false;
            due.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // estrictamente futura (>, no >=)
            return due.getTime() > today.getTime();
            } catch (e) {
            return false;
            }
        },
        message: 'La fecha límite debe ser futura'
        }
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
    }, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
    });

savingsGoalSchema.index({ user_id: 1, name: 1, isDeleted: 1 }, { unique: true });

export default mongoose.model('SavingsGoal', savingsGoalSchema);