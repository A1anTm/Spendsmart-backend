// index.js
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';

import userRoutes from '../routes/userRoutes.js';
import transactionRoutes from '../routes/transactionsRoutes.js';
import budgetRoutes from '../routes/budgetsRoutes.js';
import savingsGoalRoutes from '../routes/savingsGoalsRoutes.js';
import summaryRoutes from '../routes/summaryRoutes.js';
import categoryRoutes from '../routes/categoryRoutes.js';

import { seedCategories } from '../scripts/seedCategories.js';

config({ path: './Config/.env' });

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());
app.use(cookieParser());

// origen del frontend (puedes inyectarlo desde .env)
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-skip-token-modal', 'Accept', 'X-Requested-With'],
  })
);

app.options(
  '*',
  cors({
    origin: allowedOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-skip-token-modal', 'Accept', 'X-Requested-With'],
  })
);

app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/savings', savingsGoalRoutes);
app.use('/api/categories', categoryRoutes);

async function start() {
  try {
    // si tienes DATABASE_URL (cadena completa) la usamos tal cual
    let mongoUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();

    if (!mongoUrl) {
      // sino construimos la URL a partir de partes
      const dbUser = process.env.DB_USER;
      const dbPass = process.env.DB_PASS;
      const clusterHost = process.env.CLUSTER_HOST; // p.ej. cluster0.owgsxrc.mongodb.net
      const dbName = process.env.DB_NAME || 'spendsmart_db';

      if (!dbUser || !dbPass || !clusterHost) {
        throw new Error('Faltan variables de entorno: DATABASE_URL o (DB_USER | DB_PASS | CLUSTER_HOST)');
      }

      const userEncoded = encodeURIComponent(dbUser);
      const passEncoded = encodeURIComponent(dbPass);

      mongoUrl = `mongodb+srv://${userEncoded}:${passEncoded}@${clusterHost}/${dbName}?retryWrites=true&w=majority`;
    }

    // Conectar a MongoDB
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Conectado a MongoDB');

    if (process.env.ENABLE_SEED === 'true') {
      console.log('🔁 ENABLE_SEED=true -> ejecutando seed de categorías (upsert forzado)');
      await seedCategories({ onlyIfEmpty: false });
    } else {
      console.log('🔎 Verificando si es necesario seedear categorías (soloIfEmpty: true)');
      await seedCategories({ onlyIfEmpty: true });
    }

    app.listen(port, () => console.log(`🚀 Servidor corriendo en el puerto ${port}`));
    console.log(`🌐 CORS habilitado para: ${allowedOrigin}`);
  } catch (err) {
    console.error('❌ Error arrancando la app:', err);
    process.exit(1);
  }
}

start();

export default app;
