import { Request, Response, NextFunction } from 'express';
import Order, { IOrderDocument } from '../models/orderModel';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../middleware/asyncHandler';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    } = req.body;
    
    // Validate required fields
    if (orderItems && orderItems.length === 0) {
      return next(new ApiError('No order items', 400));
    }
    
    // Create order
    const order = await Order.create({
      orderItems,
      // @ts-ignore - User ID will be available after auth middleware
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });
    
    res.status(201).json(order);
  }
);

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email');
    
    if (!order) {
      return next(new ApiError('Order not found', 404));
    }
    
    // @ts-ignore - User ID will be available after auth middleware
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new ApiError('Not authorized to access this order', 401));
    }
    
    res.json(order);
  }
);

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
export const updateOrderToPaid = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return next(new ApiError('Order not found', 404));
    }
    
    // Update payment info
    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address,
    };
    
    const updatedOrder = await order.save();
    
    res.json(updatedOrder);
  }
);

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
export const updateOrderToDelivered = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return next(new ApiError('Order not found', 404));
    }
    
    // Update delivery status
    order.isDelivered = true;
    order.deliveredAt = new Date();
    order.status = 'delivered';
    
    const updatedOrder = await order.save();
    
    res.json(updatedOrder);
  }
);

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;
    
    if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return next(new ApiError('Invalid status', 400));
    }
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return next(new ApiError('Order not found', 404));
    }
    
    // Update order status
    order.status = status;
    
    // If status is delivered, also update delivery status
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }
    
    const updatedOrder = await order.save();
    
    res.json(updatedOrder);
  }
);

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User ID will be available after auth middleware
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
  }
);

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const orders = await Order.find({})
      .populate('user', 'id name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const count = await Order.countDocuments();
    
    res.json({
      orders,
      page,
      pages: Math.ceil(count / limit),
      total: count,
    });
  }
);

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return next(new ApiError('Order not found', 404));
    }
    
    // Only allow cancellation if order is in processing status
    if (order.status !== 'processing') {
      return next(new ApiError('Order cannot be cancelled', 400));
    }
    
    // @ts-ignore - User ID will be available after auth middleware
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new ApiError('Not authorized to cancel this order', 401));
    }
    
    // Update order status
    order.status = 'cancelled';
    
    const updatedOrder = await order.save();
    
    res.json(updatedOrder);
  }
);