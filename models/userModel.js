import mongoose from 'mongoose';
import validator from 'validator';


/**
 * Usuario de la aplicación
 *
 * Atributos principales
 * ---------------------
 * full_name          : String (trim) – Nombre completo del usuario.
 * email              : String (único, indexado) – Correo electrónico de registro.
 * password           : String (hash) – Contraseña actual.
 * resetPasswordToken : String – Token temporal para recuperación (null = sin solicitud).
 * resetPasswordExpires : Date – Caducidad del token anterior.
 * phone_number       : String – Teléfono de contacto (opcional).
 * country            : String (indexado) – País de residencia.
 * birthdate          : Date – Fecha de nacimiento.
 * bio                : String – Breve descripción personal.
 *
 * Seguridad y auditoría
 * ---------------------
 * password_history   : [{ password, changed_in }] – Histórico de contraseñas (hash + fecha).
 * access_history     : [{ device, location, adress_IP, accessed_in }] – Log de accesos.
 * total_login_count  : Number – Total de veces que inició sesión.
 * last_login_at      : Date – Último acceso exitoso.
 * is_deleted         : Boolean (indexado) – true = cuenta eliminada (soft-delete).
 * old_data           : Mixed – Respaldo de datos anteriores tras eliminación lógica.
 *
 * Datos de ubicación
 * ------------------
 * address            : { street, city, state, zip } – Dirección postal.
 *
 * Preferencias
 * ------------
 * alertSettings      : { emailAlerts, weeklyReports, monthlyReports } – Suscripciones de correo.
 * thresholdEnabled   : Boolean – Activa/desactiva alertas de presupuesto.
 *
 * Timestamps
 * ----------
 * created_at         : Date – Fecha de registro.
 * updated_at         : Date – Última actualización de cualquier campo.
 */
const userSchema = new mongoose.Schema({
    full_name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [60, 'El nombre no puede superar 60 caracteres'],
    match: [/^[a-zA-ZáéíóúüñÑ\s'-]+$/, 'El nombre contiene caracteres no válidos']
    },
    email: {
    type: String,
    required: [true, 'El correo es obligatorio'],
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
    validate: {
        validator: validator.isEmail,
        message: 'Formato de correo inválido'
    },
    maxlength: [120, 'El correo no puede superar 120 caracteres']
    },
    resetPasswordToken: {
        type: String,
        default: null,
    },
    resetPasswordExpires: {
        type: Date,
        default: null,
    },
    password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    maxlength: [128, 'La contraseña no puede superar 128 caracteres'],
    validate: {
        validator(v) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/.test(v);
        },
        message: 'Debe incluir mayúscula, minúscula, número y símbolo'
    }
    },
    phone_number: {
    type: String,
    default: null,
    validate: {
        validator(v) {
        return !v || validator.isMobilePhone(v, 'any', { strictMode: false });
        },
        message: 'Número de teléfono inválido'
    }
    },
    country:    { 
        type: String, 
        index: true, 
        default: null 
    },
    birthdate:  { 
        type: Date,   
        default: null 
    },
    bio: {
    type: String,
    default: null,
    maxlength: [250, 'La bio no puede superar 250 caracteres']
    },
    social_accounts: [{ 
        provider: String, 
        account_url: String 
    }],
    password_history: [{ 
        password: String, 
        changed_in: Date 
    }],
    access_history:  [{ 
        device: String, 
        location: String, 
        adress_IP: String, 
        accessed_in: Date 
    }],
    total_login_count: { 
        type: Number, 
        default: 0 
    },
    last_login_at:  { 
        type: Date, 
        default: null 
    },
    is_deleted:     { 
        type: Boolean, 
        default: false, 
        index: true 
    },
    old_data:       { 
        type: mongoose.Schema.Types.Mixed, 
        default: null
    },
    thresholdEnabled: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('User', userSchema);