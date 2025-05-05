import { Request, Response, NextFunction } from 'express';
import Product, { IProductDocument } from '../models/productModel';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../middleware/asyncHandler';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const keyword = req.query.keyword
      ? {
          name: {
            $regex: req.query.keyword,
            $options: 'i',
          },
        }
      : {};
      
    const category = req.query.category
      ? { category: req.query.category }
      : {};
      
    const filter = {
      ...keyword,
      ...category,
    };
    
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const count = await Product.countDocuments(filter);
    
    res.json({
      products,
      page,
      pages: Math.ceil(count / limit),
      total: count,
    });
  }
);

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return next(new ApiError('Product not found', 404));
    }
    
    res.json(product);
  }
);

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Add user as part of the request body once auth is implemented
    // req.body.user = req.user.id;
    
    const product = await Product.create(req.body);
    
    res.status(201).json(product);
  }
);

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return next(new ApiError('Product not found', 404));
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json(updatedProduct);
  }
);

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return next(new ApiError('Product not found', 404));
    }
    
    await product.deleteOne();
    
    res.json({ message: 'Product removed' });
  }
);

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
export const getTopProducts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const limit = Number(req.query.limit) || 5;
    
    const products = await Product.find({})
      .sort({ rating: -1 })
      .limit(limit);
      
    res.json(products);
  }
);

// @desc    Get products by category
// @route   GET /api/products/categories/:category
// @access  Public
export const getProductsByCategory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const products = await Product.find({ category: req.params.category })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const count = await Product.countDocuments({ category: req.params.category });
    
    res.json({
      products,
      page,
      pages: Math.ceil(count / limit),
      total: count,
    });
  }
);

// @desc    Get all categories
// @route   GET /api/products/categories
// @access  Public
export const getCategories = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const categories = await Product.distinct('category');
    
    res.json(categories);
  }
);