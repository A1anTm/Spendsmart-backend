import Category from "../models/categoryModel.js";

export const listCategories = async (req, res) => {
    try {
        const { type } = req.body; 
        const filter = type ? { appliesTo: type } : {};

        const cats = await Category.find(filter, '_id name').sort({ name: 1 });

        return res.json({ categories: cats });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: 'Error al obtener categorías' });
    }
    };