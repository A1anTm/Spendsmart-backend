import mongoose from 'mongoose';
import validator from 'validator';

/**
 * Transacción financiera del usuario
 *
 * Atributos
 * ----------
 * user_id     : ObjectId (ref: User, indexado) – Usuario propietario del movimiento.
 * type        : String ('ingreso' | 'gasto') – Naturaleza de la transacción.
 * amount      : Decimal128 – Monto de la operación (siempre positivo).
 * date        : Date – Fecha en que ocurrió (puede ser diferente a la de creación).
 * category_id : ObjectId (ref: Category, opcional) – Categoría asignada.
 * description : String (opcional) – Nota o detalle adicional.
 * created_at  : Date (automático) – Fecha y hora en que se registró la transacción.
 * updated_at  : Date (automático) – Fecha y hora de la última edición.
 */
    const transactionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'El usuario es obligatorio'],
        index: true
    },
    type: {
        type: String,
        required: [true, 'El tipo es obligatorio'],
        enum: {
        values: ['ingreso', 'gasto'],
        message: 'Tipo debe ser ingreso o gasto'
        }
    },
    amount: {
        type: mongoose.Types.Decimal128,
        required: [true, 'El monto es obligatorio'],
        validate: {
        validator(v) {
            return validator.isFloat(v.toString(), { min: 0.01 });
        },
        message: 'El monto debe ser mayor a 0'
        }
    },
    date: {
        type: Date,
        required: [true, 'La fecha es obligatoria'],
        validate: {
        validator(v) {
        return v <= new Date();;
        },
        message: 'La fecha no puede ser futura'
        }
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    description: {
        type: String,
        trim: true,
        maxlength: [250, 'La descripción no puede superar 250 caracteres']
    }
    }, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
    });

    export default mongoose.model('Transaction', transactionSchema);