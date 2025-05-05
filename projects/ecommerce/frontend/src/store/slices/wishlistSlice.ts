import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '..';
import { api } from '../../services/api';
import { Product } from './productSlice';

interface WishlistState {
  items: Product[];
  isLoading: boolean;
  error: string | null;
}

const initialState: WishlistState = {
  items: [],
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchWishlist = createAsyncThunk(
  'wishlist/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/wishlist');
      return response.data.products;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Could not fetch wishlist'
      );
    }
  }
);

export const addToWishlist = createAsyncThunk(
  'wishlist/add',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await api.post('/wishlist', { productId });
      return response.data.products;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Could not add to wishlist'
      );
    }
  }
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/remove',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/wishlist/${productId}`);
      return response.data.products;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Could not remove from wishlist'
      );
    }
  }
);

export const clearWishlist = createAsyncThunk(
  'wishlist/clear',
  async (_, { rejectWithValue }) => {
    try {
      await api.delete('/wishlist');
      return [];
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Could not clear wishlist'
      );
    }
  }
);

export const checkWishlist = createAsyncThunk(
  'wishlist/check',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/wishlist/check/${productId}`);
      return response.data.isInWishlist;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Could not check wishlist'
      );
    }
  }
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    // Local actions - for demo purposes when API is not available
    addItemLocally: (state, action: PayloadAction<Product>) => {
      const existingItem = state.items.find(
        (item) => item.id === action.payload.id
      );
      
      if (!existingItem) {
        state.items.push(action.payload);
      }
    },
    
    removeItemLocally: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    
    clearItemsLocally: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    // Fetch wishlist
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Add to wishlist
    builder
      .addCase(addToWishlist.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Remove from wishlist
    builder
      .addCase(removeFromWishlist.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Clear wishlist
    builder
      .addCase(clearWishlist.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(clearWishlist.fulfilled, (state) => {
        state.isLoading = false;
        state.items = [];
      })
      .addCase(clearWishlist.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addItemLocally, removeItemLocally, clearItemsLocally } = wishlistSlice.actions;

// Selectors
export const selectWishlistItems = (state: RootState) => state.wishlist.items;
export const selectWishlistItemCount = (state: RootState) => state.wishlist.items.length;
export const selectIsInWishlist = (productId: string) => (state: RootState) => 
  state.wishlist.items.some(item => item.id === productId);

export default wishlistSlice.reducer;