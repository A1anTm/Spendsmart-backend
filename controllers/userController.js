import User from "../models/userModel.js";
import { generatetoken } from "../middlewares/auth.js"
import bcrypt from "bcrypt";
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';



dotenv.config();

const createRefreshCookie = (res, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd, 
    sameSite: isProd ? 'none' : 'lax', 
    maxAge: 7 * 24 * 60 * 60 * 1000, 
    path: '/',
  };
  res.cookie('refreshToken', refreshToken, cookieOptions);
};


export const registerUser = async (req, res) => {
  let { full_name, email, password } = req.body;
  console.info(`[REGISTER] Intentando registrar usuario: ${email}`);

  try {
    password = password.trim();

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      console.warn(`[REGISTER] Email duplicado: ${email}`);
      if (existingEmailUser.is_deleted) {
        return res.status(400).json({
          message: 'Este correo electrónico pertenece a un usuario eliminado.',
        });
      }
      return res.status(409).json({ message: 'El correo electrónico ya está en uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ full_name: full_name.trim(), email, password: hashedPassword });
    await newUser.save();

    console.info(`[REGISTER] Usuario creado: ${newUser._id} (${email})`);

    const accessToken = generatetoken(newUser);
    const refreshToken = jwt.sign(
      { _id: newUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    createRefreshCookie(res, refreshToken);

    return res.status(200).json({
      message: 'Usuario creado exitosamente.',
      token: accessToken,
    });
  } catch (error) {
    console.error('[REGISTER] Error interno:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  console.info(`[LOGIN] Intento de acceso para: ${email}`);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`[LOGIN] Email no existe: ${email}`);
      return res.status(401).json({ email: 'Email incorrecto' });
    }

    if (user.is_deleted) {
      console.warn(`[LOGIN] Usuario eliminado intentó acceder: ${email}`);
      return res.status(400).json({ message: 'Este usuario ha sido eliminado y no puede iniciar sesión.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.warn(`[LOGIN] Contraseña incorrecta: ${email}`);
      return res.status(401).json({ password: 'Contraseña incorrecta' });
    }

    const accessToken = generatetoken(user);
    const refreshToken = jwt.sign(
      { _id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    createRefreshCookie(res, refreshToken);

    console.info(`[LOGIN] Login exitoso: ${email} (id: ${user._id})`);
    return res.status(200).json({
      message: 'Usuario logueado exitosamente.',
      token: accessToken,
    });
  } catch (error) {
    console.error('[LOGIN] Error interno:', error);
    return res.status(500).json({ name: error.name, error: error.message });
  }
};


export const forgotPasswordController = async (req, res) => {
    const { email } = req.body;
    console.info(`[FORGOT-PASSWORD] Solicitud para: ${email}`);

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.warn(`[FORGOT-PASSWORD] Email no encontrado: ${email}`);
            return res.status(404).json({ message: 'No se encontró un usuario con ese correo electrónico.' });
        }

        const resetPasswordToken = Math.floor(100000 + Math.random() * 900000).toString();
        const resetPasswordExpires = Date.now() + 3600000;

        user.resetPasswordToken = resetPasswordToken;
        user.resetPasswordExpires = resetPasswordExpires;
        await user.save();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Recuperación de Contraseña',
            html: `<p>Para restablecer su contraseña, ingrese el siguiente código:</p><p><strong>${resetPasswordToken}</strong></p>`,
        };

        await transporter.sendMail(mailOptions);
        console.info(`[FORGOT-PASSWORD] Código enviado a: ${email} -> ${resetPasswordToken}`);

        res.status(200).json({ message: 'Se ha enviado el código de recuperación de contraseña.' });
    } catch (error) {
        console.error('[FORGOT-PASSWORD] Error al enviar correo:', error);
        res.status(500).json({ message: 'Error al enviar el correo.' });
    }
};

export const resetPasswordController = async (req, res) => {
    const { code, password } = req.body;
    console.info(`[RESET-PASSWORD] Solicitud con código: ${code}`);

    try {
        const user = await User.findOne({ resetPasswordToken: code, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) {
            console.warn(`[RESET-PASSWORD] Código inválido o expirado: ${code}`);
            return res.status(400).json({ message: 'Código inválido o ha expirado.' });
        }

        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        console.info(`[RESET-PASSWORD] Contraseña actualizada para: ${user.email}`);
        res.status(200).json({ message: 'Contraseña restablecida con éxito.' });
    } catch (error) {
        console.error('[RESET-PASSWORD] Error interno:', error);
        res.status(500).json({ message: 'Error al restablecer la contraseña.' });
    }
};


export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('full_name birthdate phone_number country address social_accounts bio')
      .lean(); // más rápido y limpio

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    return res.json({ user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      full_name,
      phone_number,
      birthdate,
      country,
      bio,
      social_accounts
    } = req.body;

    // Construimos el objeto updates sólo con los campos presentes en el body
    const updates = {};

    if (typeof full_name === 'string') updates.full_name = full_name.trim();
    if (typeof phone_number === 'string') updates.phone_number = phone_number.trim();
    if (typeof country === 'string') updates.country = country.trim();
    if (typeof bio === 'string') updates.bio = bio.trim();

    if (birthdate !== undefined) {
      if (birthdate === '' || birthdate === null) {
        updates.birthdate = null;
      } else {
        const d = new Date(birthdate);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ message: 'Fecha de nacimiento inválida' });
        }
        updates.birthdate = d;
      }
    }

    if (Array.isArray(social_accounts)) {
      updates.social_accounts = social_accounts;
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true, context: 'query' }
    )
      .select('-password -password_history -resetPasswordToken -resetPasswordExpires') // no enviar datos sensibles
      .lean();

    if (!updated) return res.status(404).json({ message: 'Usuario no encontrado' });

    return res.json({ message: 'Perfil actualizado con éxito', user: updated });
  } catch (e) {
    console.error('[UPDATE-PROFILE] Error:', e);
    if (e.name === 'ValidationError') {
      return res.status(400).json({ message: 'Datos inválidos', details: e.errors });
    }
    return res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};


export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Faltan contraseñas' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña actual incorrecta' });

    const repeated = await Promise.all(
      user.password_history.map(async (ph) => bcrypt.compare(newPassword, ph.password))
    );
    if (repeated.some(Boolean)) {
      return res.status(409).json({ message: 'No puedes reutilizar una contraseña anterior' });
    }

    user.password_history.push({ password: user.password, changed_in: new Date() });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Contraseña actualizada con éxito' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
};

export const refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token requerido' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded._id);
    if (!user || user.is_deleted) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(403).json({ message: 'Refresh token inválido' });
    }

    const newAccessToken = generatetoken(user);
    const newRefreshToken = jwt.sign({ _id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/' });
    return res.status(403).json({ message: 'Refresh token inválido o expirado' });
  }
};
