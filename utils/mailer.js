import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.error('[MAILER] Falta EMAIL_USER o EMAIL_PASS');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });
}

export async function sendMail(mailOptions) {
  const transporter = createTransporter();
  if (!transporter) throw new Error('Transporter no disponible');

  try {
    await transporter.verify();
    console.log('[MAILER] verify OK');
  } catch (err) {
    console.warn('[MAILER] verify WARNING (no abortamos):', err && err.message ? err.message : err);
    // no retornamos aquí; intentamos sendMail para ver la respuesta real
  }

  const info = await transporter.sendMail(mailOptions);
  // info contiene accepted, rejected, response, messageId
  console.log('[MAILER] sendMail result:', {
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    messageId: info.messageId
  });
  return info;
}