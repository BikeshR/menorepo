import { Request, Response, NextFunction } from 'express';
import Review, { IReviewDocument } from '../models/reviewModel';
import Product from '../models/productModel';
import Order from '../models/orderModel';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../middleware/asyncHandler';

// @desc    Create a new review
// @route   POST /api/products/:id/reviews
// @access  Private
export const createProductReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { rating, title, comment, isRecommended } = req.body;
    const productId = req.params.id;
    
    // @ts-ignore - User will be added by auth middleware
    const userId = req.user._id;
    
    // Validate required fields
    if (!rating || !title || !comment) {
      return next(new ApiError('Please fill in all required fields', 400));
    }
    
    // Find the product
    const product = await Product.findById(productId);
    
    if (!product) {
      return next(new ApiError('Product not found', 404));
    }
    
    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });
    
    if (existingReview) {
      return next(new ApiError('You have already reviewed this product', 400));
    }
    
    // Check if user has purchased the product (verification)
    // @ts-ignore - User will be added by auth middleware
    const purchasedProduct = await Order.findOne({
      user: userId,
      'orderItems.product': productId,
      isPaid: true,
    });
    
    const isVerifiedPurchase = !!purchasedProduct;
    
    // @ts-ignore - User will be added by auth middleware
    const userName = req.user.name;
    
    // Create the review
    const review = await Review.create({
      user: userId,
      product: productId,
      name: userName,
      rating,
      title,
      comment,
      isRecommended: isRecommended !== undefined ? isRecommended : true,
      isVerifiedPurchase,
      helpfulVotes: 0,
      images: req.body.images || [],
    });
    
    // Update product rating stats
    const allReviews = await Review.find({ product: productId });
    const totalRatings = allReviews.reduce((sum, item) => sum + item.rating, 0);
    
    product.rating = totalRatings / allReviews.length;
    product.numReviews = allReviews.length;
    
    await product.save();
    
    res.status(201).json(review);
  }
);

// @desc    Get all reviews for a product
// @route   GET /api/products/:id/reviews
// @access  Public
export const getProductReviews = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.params.id;
    
    // Parse query parameters
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Sort options
    const sortOption = req.query.sort || '-createdAt'; // Default: newest first
    
    // Filter options
    const ratingFilter = req.query.rating
      ? { rating: Number(req.query.rating) }
      : {};
      
    const verifiedFilter = req.query.verified === 'true'
      ? { isVerifiedPurchase: true }
      : {};
      
    const recommendedFilter = req.query.recommended === 'true'
      ? { isRecommended: true }
      : {};
    
    // Combine filters
    const filter = {
      product: productId,
      ...ratingFilter,
      ...verifiedFilter,
      ...recommendedFilter,
    };
    
    // Get reviews with pagination and sorting
    const reviews = await Review.find(filter)
      .sort(sortOption as string)
      .skip(skip)
      .limit(limit);
      
    // Get total count for pagination
    const totalReviews = await Review.countDocuments(filter);
    
    // Calculate rating statistics
    const allRatings = await Review.find({ product: productId });
    
    const ratingStats = {
      averageRating: 0,
      totalReviews: allRatings.length,
      ratingCounts: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
      recommendedPercentage: 0,
    };
    
    if (allRatings.length > 0) {
      // Calculate average rating
      const totalRating = allRatings.reduce((sum, review) => sum + review.rating, 0);
      ratingStats.averageRating = totalRating / allRatings.length;
      
      // Count ratings by star
      allRatings.forEach((review) => {
        // @ts-ignore - TypeScript doesn't know the exact keys
        ratingStats.ratingCounts[review.rating]++;
      });
      
      // Calculate recommendation percentage
      const recommendedCount = allRatings.filter(
        (review) => review.isRecommended
      ).length;
      ratingStats.recommendedPercentage =
        (recommendedCount / allRatings.length) * 100;
    }
    
    res.json({
      reviews,
      page,
      pages: Math.ceil(totalReviews / limit),
      totalReviews,
      ratingStats,
    });
  }
);

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const reviewId = req.params.id;
    const { rating, title, comment, isRecommended } = req.body;
    
    // Find the review
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return next(new ApiError('Review not found', 404));
    }
    
    // Check if user owns the review
    // @ts-ignore - User will be added by auth middleware
    if (review.user.toString() !== req.user._id.toString()) {
      return next(new ApiError('Not authorized to update this review', 401));
    }
    
    // Update the review
    if (rating) review.rating = rating;
    if (title) review.title = title;
    if (comment) review.comment = comment;
    if (isRecommended !== undefined) review.isRecommended = isRecommended;
    if (req.body.images) review.images = req.body.images;
    
    const updatedReview = await review.save();
    
    // Update product rating
    const product = await Product.findById(review.product);
    
    if (product) {
      const allReviews = await Review.find({ product: review.product });
      const totalRatings = allReviews.reduce((sum, item) => sum + item.rating, 0);
      
      product.rating = totalRatings / allReviews.length;
      await product.save();
    }
    
    res.json(updatedReview);
  }
);

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const reviewId = req.params.id;
    
    // Find the review
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return next(new ApiError('Review not found', 404));
    }
    
    // Check if user owns the review or is admin
    // @ts-ignore - User will be added by auth middleware
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new ApiError('Not authorized to delete this review', 401));
    }
    
    const productId = review.product;
    
    // Delete the review
    await review.deleteOne();
    
    // Update product rating
    const product = await Product.findById(productId);
    
    if (product) {
      const allReviews = await Review.find({ product: productId });
      
      if (allReviews.length === 0) {
        product.rating = 0;
        product.numReviews = 0;
      } else {
        const totalRatings = allReviews.reduce((sum, item) => sum + item.rating, 0);
        product.rating = totalRatings / allReviews.length;
        product.numReviews = allReviews.length;
      }
      
      await product.save();
    }
    
    res.json({ message: 'Review removed' });
  }
);

// @desc    Mark a review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
export const markReviewAsHelpful = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const reviewId = req.params.id;
    
    // Find the review
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return next(new ApiError('Review not found', 404));
    }
    
    // Increment helpful votes
    review.helpfulVotes += 1;
    
    const updatedReview = await review.save();
    
    res.json(updatedReview);
  }
);