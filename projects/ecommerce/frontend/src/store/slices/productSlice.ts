import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  inStock: boolean;
  rating: number;
  numReviews: number;
}

interface ProductsState {
  items: Product[];
  filteredItems: Product[];
  categories: string[];
  selectedCategory: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProductsState = {
  items: [],
  filteredItems: [],
  categories: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
};

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/products');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch products');
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setSelectedCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload;
      
      if (action.payload) {
        state.filteredItems = state.items.filter(
          (product) => product.category === action.payload
        );
      } else {
        state.filteredItems = state.items;
      }
    },
    
    searchProducts: (state, action: PayloadAction<string>) => {
      const searchTerm = action.payload.toLowerCase();
      
      if (searchTerm.trim() === '') {
        state.filteredItems = state.selectedCategory
          ? state.items.filter((product) => product.category === state.selectedCategory)
          : state.items;
        return;
      }
      
      state.filteredItems = state.items.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                             product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = state.selectedCategory 
          ? product.category === state.selectedCategory
          : true;
          
        return matchesSearch && matchesCategory;
      });
    },
    
    sortProducts: (state, action: PayloadAction<'price-asc' | 'price-desc' | 'rating'>) => {
      const sortType = action.payload;
      
      switch (sortType) {
        case 'price-asc':
          state.filteredItems.sort((a, b) => a.price - b.price);
          break;
        case 'price-desc':
          state.filteredItems.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          state.filteredItems.sort((a, b) => b.rating - a.rating);
          break;
        default:
          break;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
        state.isLoading = false;
        state.items = action.payload;
        state.filteredItems = action.payload;
        
        // Extract unique categories
        const categorySet = new Set<string>();
        action.payload.forEach((product) => {
          categorySet.add(product.category);
        });
        state.categories = Array.from(categorySet);
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to fetch products';
      });
  },
});

export const { setSelectedCategory, searchProducts, sortProducts } = productSlice.actions;

export default productSlice.reducer;