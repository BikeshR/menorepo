import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/userController';
// Import auth middleware when ready
// import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Register and get all users
router.route('/')
  .post(registerUser)
  .get(/*protect, admin,*/ getUsers);

// Login user
router.post('/login', loginUser);

// User profile routes
router.route('/profile')
  .get(/*protect,*/ getUserProfile)
  .put(/*protect,*/ updateUserProfile);

// Admin routes for user management
router.route('/:id')
  .get(/*protect, admin,*/ getUserById)
  .put(/*protect, admin,*/ updateUser)
  .delete(/*protect, admin,*/ deleteUser);

export default router;