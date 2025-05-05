import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from './asyncHandler';
import { ApiError } from '../utils/apiError';
import User, { IUserDocument } from '../models/userModel';
import config from '../config';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

interface JwtPayload {
  id: string;
}

// Protect routes - require authentication
export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token;

    // Check for token in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      try {
        // Get token from header
        token = req.headers.authorization.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

        // Get user from token
        req.user = await User.findById(decoded.id).select('-password');

        next();
      } catch (error) {
        console.error(error);
        throw new ApiError('Not authorized, token failed', 401);
      }
    }

    if (!token) {
      throw new ApiError('Not authorized, no token provided', 401);
    }
  }
);

// Admin middleware
export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    throw new ApiError('Not authorized as an admin', 403);
  }
};

// Validate user input
export const validateUserInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, email, password } = req.body;

  // Check required fields
  if (!name || !email || !password) {
    throw new ApiError('Please provide all required fields', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError('Please provide a valid email address', 400);
  }

  // Validate password strength
  if (password.length < 6) {
    throw new ApiError('Password must be at least 6 characters', 400);
  }

  next();
};