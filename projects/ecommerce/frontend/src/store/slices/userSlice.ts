import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';

interface UserInfo {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  token: string;
}

interface UserState {
  userInfo: UserInfo | null;
  isLoading: boolean;
  error: string | null;
}

// Initialize state from localStorage
const userInfoFromStorage = localStorage.getItem('userInfo')
  ? JSON.parse(localStorage.getItem('userInfo')!)
  : null;

const initialState: UserState = {
  userInfo: userInfoFromStorage,
  isLoading: false,
  error: null,
};

// Async thunks
export const login = createAsyncThunk(
  'user/login',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const data = await authApi.login(email, password);
      
      // Save user info to localStorage
      localStorage.setItem('userInfo', JSON.stringify(data));
      localStorage.setItem('token', data.token);
      
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Something went wrong'
      );
    }
  }
);

export const register = createAsyncThunk(
  'user/register',
  async (
    {
      name,
      email,
      password,
    }: { name: string; email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const data = await authApi.register(name, email, password);
      
      // Save user info to localStorage
      localStorage.setItem('userInfo', JSON.stringify(data));
      localStorage.setItem('token', data.token);
      
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Something went wrong'
      );
    }
  }
);

export const logout = createAsyncThunk('user/logout', async () => {
  authApi.logout();
  localStorage.removeItem('userInfo');
  localStorage.removeItem('token');
  return null;
});

export const getUserProfile = createAsyncThunk(
  'user/profile',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authApi.getUserProfile();
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Something went wrong'
      );
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'user/updateProfile',
  async (userData: any, { rejectWithValue }) => {
    try {
      const data = await authApi.updateUserProfile(userData);
      
      // Update user info in localStorage
      localStorage.setItem('userInfo', JSON.stringify(data));
      
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Something went wrong'
      );
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<UserInfo>) => {
        state.isLoading = false;
        state.userInfo = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<UserInfo>) => {
        state.isLoading = false;
        state.userInfo = action.payload;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.userInfo = null;
    });
    
    // Get User Profile
    builder
      .addCase(getUserProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userInfo = {
          ...state.userInfo,
          ...action.payload,
        } as UserInfo;
      })
      .addCase(getUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
    
    // Update User Profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateUserProfile.fulfilled, (state, action: PayloadAction<UserInfo>) => {
        state.isLoading = false;
        state.userInfo = action.payload;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = userSlice.actions;

export default userSlice.reducer;