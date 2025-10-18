// test-mongo.js
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: './Config/.env' }); // o '.env' según dónde esté

const run = async () => {
  try {
    const mongoUrl = process.env.DATABASE_URL || process.env.MONGODB_URI;
    if (!mongoUrl) throw new Error('No encontré DATABASE_URL en .env');
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Conectado a MongoDB (test-mongo)');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error conexión Mongo (test-mongo):', e.message || e);
    process.exit(1);
  }
};
run();
