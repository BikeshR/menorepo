import { Request, Response, NextFunction } from 'express';
import Wishlist from '../models/wishlistModel';
import Product from '../models/productModel';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../middleware/asyncHandler';

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User will be added by auth middleware
    const userId = req.user._id;
    
    let wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'products',
      select: 'name price image rating inStock category',
    });
    
    if (!wishlist) {
      // Create empty wishlist if none exists
      wishlist = await Wishlist.create({
        user: userId,
        products: [],
      });
      
      wishlist = await Wishlist.findOne({ user: userId }).populate({
        path: 'products',
        select: 'name price image rating inStock category',
      });
    }
    
    res.json(wishlist);
  }
);

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
export const addToWishlist = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { productId } = req.body;
    
    // Check if product exists
    const product = await Product.findById(productId);
    
    if (!product) {
      return next(new ApiError('Product not found', 404));
    }
    
    // @ts-ignore - User will be added by auth middleware
    const userId = req.user._id;
    
    // Find user's wishlist or create if it doesn't exist
    let wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: userId,
        products: [productId],
      });
    } else {
      // Check if product is already in the wishlist
      if (wishlist.products.includes(productId)) {
        return next(new ApiError('Product already in wishlist', 400));
      }
      
      // Add product to wishlist
      wishlist.products.push(productId);
      await wishlist.save();
    }
    
    // Return updated wishlist with populated product details
    const updatedWishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'products',
      select: 'name price image rating inStock category',
    });
    
    res.status(201).json(updatedWishlist);
  }
);

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:id
// @access  Private
export const removeFromWishlist = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    
    // @ts-ignore - User will be added by auth middleware
    const userId = req.user._id;
    
    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      return next(new ApiError('Wishlist not found', 404));
    }
    
    // Check if product is in the wishlist
    if (!wishlist.products.includes(productId)) {
      return next(new ApiError('Product not in wishlist', 400));
    }
    
    // Remove product from wishlist
    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== productId
    );
    
    await wishlist.save();
    
    // Return updated wishlist with populated product details
    const updatedWishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'products',
      select: 'name price image rating inStock category',
    });
    
    res.json(updatedWishlist);
  }
);

// @desc    Clear wishlist
// @route   DELETE /api/wishlist
// @access  Private
export const clearWishlist = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User will be added by auth middleware
    const userId = req.user._id;
    
    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      return next(new ApiError('Wishlist not found', 404));
    }
    
    // Clear wishlist
    wishlist.products = [];
    await wishlist.save();
    
    res.json({ message: 'Wishlist cleared' });
  }
);

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:id
// @access  Private
export const checkWishlist = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    
    // @ts-ignore - User will be added by auth middleware
    const userId = req.user._id;
    
    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      return res.json({ isInWishlist: false });
    }
    
    // Check if product is in the wishlist
    const isInWishlist = wishlist.products.some(
      (id) => id.toString() === productId
    );
    
    res.json({ isInWishlist });
  }
);