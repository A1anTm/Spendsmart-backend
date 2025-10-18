import mongoose from 'mongoose';

/**
 * Categoría de transacción
 *
 * Atributos
 * ----------
 * name      : String (único, indexado) – Nombre descriptivo de la categoría.
 * appliesTo : String ('ingreso' | 'gasto') – Indica si la categoría se usa para ingresos o gastos.
 * createdAt : Date (automático) – Fecha y hora de creación del registro.
 * updatedAt : Date (automático) – Fecha y hora de la última modificación.
 */
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  appliesTo: {
    type: String,
    enum: ['ingreso', 'gasto'],
    default: 'gasto'
  }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);

async function ensureDefaultCategories() {
  const count = await Category.countDocuments();
  if (count === 0) {
    await seedCategories(); 
    console.log('Categorias por defecto creadas');
  } else {
    console.log('Categorias ya existen:', count);
  }
}
