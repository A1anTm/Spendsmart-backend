// lib/seedCategories.js
import Category from '../models/categoryModel.js';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentos', appliesTo: 'gasto' },
  { name: 'Entretenimiento', appliesTo: 'gasto' },
  { name: 'Comida Fuera', appliesTo: 'gasto' },
  { name: 'Vivienda', appliesTo: 'gasto' },
  { name: 'Transporte', appliesTo: 'gasto' },
  { name: 'Salud', appliesTo: 'gasto' },
  { name: 'Educación', appliesTo: 'gasto' },
  { name: 'Otros', appliesTo: 'gasto' },
  { name: 'Salario', appliesTo: 'ingreso' },
  { name: 'Freelance', appliesTo: 'ingreso' },
  { name: 'Inversiones', appliesTo: 'ingreso' },
  { name: 'Ventas', appliesTo: 'ingreso' },
  { name: 'Otros Ingresos', appliesTo: 'ingreso' }
];

export async function seedCategories({ onlyIfEmpty = false } = {}) {
  try {
    await Category.init();
  } catch (err) {
    console.warn('Warning: error inicializando índices de Category', err);
  }

  if (onlyIfEmpty) {
    const count = await Category.countDocuments();
    if (count > 0) {
      console.log(`Categories already present (${count}), skipping seed.`);
      return;
    }
  }

  for (const cat of DEFAULT_CATEGORIES) {
    try {
      const res = await Category.updateOne(
        { name: cat.name },
        { $setOnInsert: { name: cat.name, appliesTo: cat.appliesTo } },
        { upsert: true }
      );

      if (res.upsertedCount && res.upsertedCount > 0) {
        console.log(`✅ Created category "${cat.name}" (${cat.appliesTo})`);
      } else {
        console.log(`ℹ️  Category "${cat.name}" already exists`);
      }
    } catch (err) {
      if (err.code === 11000) {
        console.log(`⚠️  Duplicate key for "${cat.name}" (concurrency), skipping`);
      } else {
        console.error(`Error upserting category "${cat.name}":`, err);
      }
    }
  }

  console.log('Seed categories finished.');
}
