import mongoose, { Document, Schema } from 'mongoose';

export interface IReview {
  user: mongoose.Schema.Types.ObjectId;
  product: mongoose.Schema.Types.ObjectId;
  name: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  isRecommended: boolean;
  helpfulVotes: number;
  images?: string[];
}

export interface IReviewDocument extends IReview, Document {
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReviewDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    product: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    name: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    isRecommended: {
      type: Boolean,
      default: true,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    images: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create compound index for user and product to prevent duplicate reviews
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

const Review = mongoose.model<IReviewDocument>('Review', reviewSchema);

export default Review;