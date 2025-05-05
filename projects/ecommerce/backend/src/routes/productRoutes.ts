import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getTopProducts,
  getProductsByCategory,
  getCategories,
} from '../controllers/productController';
// Import auth middleware when ready
// import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Get all products and create new product
router.route('/')
  .get(getProducts)
  .post(/*protect, admin,*/ createProduct);

// Get top rated products
router.get('/top', getTopProducts);

// Get all categories
router.get('/categories', getCategories);

// Get products by category
router.get('/categories/:category', getProductsByCategory);

// Get, update, and delete product by ID
router.route('/:id')
  .get(getProductById)
  .put(/*protect, admin,*/ updateProduct)
  .delete(/*protect, admin,*/ deleteProduct);

export default router;