import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct {
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  inStock: boolean;
  countInStock: number;
  rating: number;
  numReviews: number;
}

export interface IProductDocument extends IProduct, Document {}

const productSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a product description'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please provide a product price'],
      min: [0, 'Price must be positive'],
    },
    image: {
      type: String,
      required: [true, 'Please provide a product image'],
    },
    category: {
      type: String,
      required: [true, 'Please provide a product category'],
      trim: true,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    countInStock: {
      type: Number,
      required: [true, 'Please provide count in stock'],
      min: [0, 'Count in stock must be non-negative'],
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating cannot be more than 5'],
    },
    numReviews: {
      type: Number,
      default: 0,
      min: [0, 'Number of reviews must be non-negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for product availability
productSchema.virtual('isAvailable').get(function (this: IProductDocument) {
  return this.inStock && this.countInStock > 0;
});

// Index for faster searching
productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model<IProductDocument>('Product', productSchema);

export default Product;