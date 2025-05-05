import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../store';
import { getUserProfile, updateUserProfile } from '../store/slices/userSlice';
import { ordersApi } from '../services/api';
import Breadcrumb from '../components/common/Breadcrumb';
import OrderItem from '../components/user/OrderItem';

interface UserProfileForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface OrderSummary {
  _id: string;
  orderNumber: string;
  createdAt: string;
  totalPrice: number;
  isPaid: boolean;
  isDelivered: boolean;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: number;
}

const ProfilePage: React.FC = () => {
  const { userInfo, isLoading, error } = useSelector(
    (state: RootState) => state.user
  );
  const dispatch = useDispatch();
  
  // State for user form
  const [formData, setFormData] = useState<UserProfileForm>({
    name: userInfo?.name || '',
    email: userInfo?.email || '',
    password: '',
    confirmPassword: '',
  });
  
  // State for form errors
  const [formErrors, setFormErrors] = useState<Partial<UserProfileForm>>({});
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  
  // State for orders
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('profile');
  
  // Fetch user profile on mount
  useEffect(() => {
    // @ts-ignore
    dispatch(getUserProfile());
  }, [dispatch]);
  
  // Fetch orders on mount
  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoadingOrders(true);
      try {
        // In a real app, we'd call the API here
        // For demo purposes, we'll use mock data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockOrders: OrderSummary[] = [
          {
            _id: '1',
            orderNumber: 'ORD-12345',
            createdAt: '2023-06-01T12:00:00Z',
            totalPrice: 125.99,
            isPaid: true,
            isDelivered: true,
            status: 'delivered',
            items: 3,
          },
          {
            _id: '2',
            orderNumber: 'ORD-12346',
            createdAt: '2023-05-15T09:30:00Z',
            totalPrice: 89.99,
            isPaid: true,
            isDelivered: false,
            status: 'shipped',
            items: 2,
          },
          {
            _id: '3',
            orderNumber: 'ORD-12347',
            createdAt: '2023-05-05T14:45:00Z',
            totalPrice: 45.50,
            isPaid: true,
            isDelivered: true,
            status: 'delivered',
            items: 1,
          },
        ];
        
        setOrders(mockOrders);
      } catch (error) {
        setOrdersError('Failed to fetch orders. Please try again.');
      } finally {
        setIsLoadingOrders(false);
      }
    };
    
    if (userInfo) {
      fetchOrders();
    }
  }, [userInfo]);
  
  // Update formData when userInfo changes
  useEffect(() => {
    if (userInfo) {
      setFormData({
        name: userInfo.name,
        email: userInfo.email,
        password: '',
        confirmPassword: '',
      });
    }
  }, [userInfo]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormData({ ...formData, [name]: value });
    
    // Clear error when user starts typing
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors({ ...formErrors, [name]: undefined });
    }
    
    // Clear success message when user starts editing
    if (formSuccess) {
      setFormSuccess(null);
    }
  };
  
  const validateForm = () => {
    const errors: Partial<UserProfileForm> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = validateForm();
    
    if (isValid) {
      // Prepare user data for update
      const userData = {
        name: formData.name,
        email: formData.email,
        ...(formData.password && { password: formData.password }),
      };
      
      // @ts-ignore
      dispatch(updateUserProfile(userData))
        .unwrap()
        .then(() => {
          setFormSuccess('Profile updated successfully');
          // Clear password fields
          setFormData({ ...formData, password: '', confirmPassword: '' });
        })
        .catch((error: any) => {
          console.error('Update failed:', error);
        });
    }
  };
  
  return (
    <ProfilePageContainer>
      <Breadcrumb
        items={[
          { label: 'Home', path: '/' },
          { label: 'Profile', path: '/profile' },
        ]}
      />
      
      <ProfileHeader>
        <h1>My Account</h1>
        <LastLogin>Last login: {new Date().toLocaleDateString()}</LastLogin>
      </ProfileHeader>
      
      <ProfileTabs>
        <ProfileTab
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </ProfileTab>
        <ProfileTab
          active={activeTab === 'orders'}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </ProfileTab>
        <ProfileTab
          active={activeTab === 'wishlist'}
          onClick={() => setActiveTab('wishlist')}
        >
          Wishlist
        </ProfileTab>
        <ProfileTab
          active={activeTab === 'addresses'}
          onClick={() => setActiveTab('addresses')}
        >
          Addresses
        </ProfileTab>
      </ProfileTabs>
      
      <ProfileContent>
        {activeTab === 'profile' && (
          <ProfileSection>
            <SectionTitle>Personal Information</SectionTitle>
            
            {formSuccess && <SuccessMessage>{formSuccess}</SuccessMessage>}
            {error && <ErrorMessage>{error}</ErrorMessage>}
            
            <ProfileForm onSubmit={handleSubmit}>
              <FormGroup>
                <Label htmlFor="name">Name</Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  hasError={!!formErrors.name}
                />
                {formErrors.name && <ErrorText>{formErrors.name}</ErrorText>}
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  hasError={!!formErrors.email}
                />
                {formErrors.email && <ErrorText>{formErrors.email}</ErrorText>}
              </FormGroup>
              
              <FormDivider />
              <SectionTitle>Change Password</SectionTitle>
              <PasswordNote>Leave blank to keep current password</PasswordNote>
              
              <FormGroup>
                <Label htmlFor="password">New Password</Label>
                <Input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  hasError={!!formErrors.password}
                />
                {formErrors.password && <ErrorText>{formErrors.password}</ErrorText>}
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  hasError={!!formErrors.confirmPassword}
                />
                {formErrors.confirmPassword && (
                  <ErrorText>{formErrors.confirmPassword}</ErrorText>
                )}
              </FormGroup>
              
              <FormActions>
                <SubmitButton type="submit" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Profile'}
                </SubmitButton>
              </FormActions>
            </ProfileForm>
          </ProfileSection>
        )}
        
        {activeTab === 'orders' && (
          <OrdersSection>
            <SectionTitle>My Orders</SectionTitle>
            
            {isLoadingOrders ? (
              <LoadingMessage>Loading your orders...</LoadingMessage>
            ) : ordersError ? (
              <ErrorMessage>{ordersError}</ErrorMessage>
            ) : orders.length === 0 ? (
              <EmptyState>
                <EmptyStateTitle>No orders found</EmptyStateTitle>
                <EmptyStateText>
                  You haven't placed any orders yet. Start shopping now!
                </EmptyStateText>
                <ShopNowButton to="/products">Shop Now</ShopNowButton>
              </EmptyState>
            ) : (
              <OrdersList>
                {orders.map((order) => (
                  <OrderItem key={order._id} order={order} />
                ))}
              </OrdersList>
            )}
          </OrdersSection>
        )}
        
        {activeTab === 'wishlist' && (
          <WishlistSection>
            <SectionTitle>My Wishlist</SectionTitle>
            <EmptyState>
              <EmptyStateTitle>Your wishlist is empty</EmptyStateTitle>
              <EmptyStateText>
                Save items you're interested in by clicking the heart icon on product pages
              </EmptyStateText>
              <ShopNowButton to="/products">Explore Products</ShopNowButton>
            </EmptyState>
          </WishlistSection>
        )}
        
        {activeTab === 'addresses' && (
          <AddressesSection>
            <SectionHeader>
              <SectionTitle>My Addresses</SectionTitle>
              <AddButton>Add New Address</AddButton>
            </SectionHeader>
            
            <EmptyState>
              <EmptyStateTitle>No addresses saved</EmptyStateTitle>
              <EmptyStateText>
                Add your delivery addresses to make checkout faster
              </EmptyStateText>
              <AddAddressButton>Add Address</AddAddressButton>
            </EmptyState>
          </AddressesSection>
        )}
      </ProfileContent>
    </ProfilePageContainer>
  );
};

export default ProfilePage;

// Styled Components
const ProfilePageContainer = styled.div\`
  width: 100%;
\`;

const ProfileHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  
  h1 {
    margin: 0;
  }
  
  @media (max-width: 576px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
\`;

const LastLogin = styled.span\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const ProfileTabs = styled.div\`
  display: flex;
  border-bottom: 1px solid var(--gray-medium);
  margin-bottom: 2rem;
  
  @media (max-width: 576px) {
    flex-wrap: wrap;
  }
\`;

interface ProfileTabProps {
  active: boolean;
}

const ProfileTab = styled.button<ProfileTabProps>\`
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid ${(props) => (props.active ? 'var(--primary-color)' : 'transparent')};
  color: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--text-color)')};
  font-weight: ${(props) => (props.active ? '500' : 'normal')};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: var(--primary-color);
  }
  
  @media (max-width: 576px) {
    flex: 1 0 50%;
    padding: 0.75rem 1rem;
    text-align: center;
  }
\`;

const ProfileContent = styled.div\`
  // Styles for content container
\`;

const ProfileSection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
  
  @media (max-width: 576px) {
    padding: 1.5rem;
  }
\`;

const OrdersSection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
  
  @media (max-width: 576px) {
    padding: 1.5rem;
  }
\`;

const WishlistSection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
  
  @media (max-width: 576px) {
    padding: 1.5rem;
  }
\`;

const AddressesSection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
  
  @media (max-width: 576px) {
    padding: 1.5rem;
  }
\`;

const SectionHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
\`;

const SectionTitle = styled.h2\`
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
\`;

const AddButton = styled.button\`
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const ProfileForm = styled.form\`
  // Styles for form
\`;

const FormGroup = styled.div\`
  margin-bottom: 1.5rem;
\`;

const Label = styled.label\`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
\`;

interface InputProps {
  hasError?: boolean;
}

const Input = styled.input<InputProps>\`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${(props) => (props.hasError ? 'var(--error-color)' : 'var(--gray-medium)')};
  border-radius: var(--border-radius);
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(58, 134, 255, 0.2);
  }
\`;

const ErrorText = styled.div\`
  color: var(--error-color);
  font-size: 0.8rem;
  margin-top: 0.25rem;
\`;

const FormDivider = styled.div\`
  height: 1px;
  background-color: var(--gray-light);
  margin: 2rem 0;
\`;

const PasswordNote = styled.p\`
  font-size: 0.9rem;
  color: var(--gray-dark);
  margin-top: -1rem;
  margin-bottom: 1.5rem;
\`;

const FormActions = styled.div\`
  display: flex;
  justify-content: flex-end;
\`;

const SubmitButton = styled.button\`
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  
  &:hover:not(:disabled) {
    background-color: #3178cf;
  }
  
  &:disabled {
    background-color: var(--gray-medium);
    cursor: not-allowed;
  }
\`;

const SuccessMessage = styled.div\`
  background-color: rgba(76, 175, 80, 0.1);
  border: 1px solid var(--success-color);
  color: var(--success-color);
  padding: 0.8rem;
  border-radius: var(--border-radius);
  margin-bottom: 1.5rem;
\`;

const ErrorMessage = styled.div\`
  background-color: rgba(244, 67, 54, 0.1);
  border: 1px solid var(--error-color);
  color: var(--error-color);
  padding: 0.8rem;
  border-radius: var(--border-radius);
  margin-bottom: 1.5rem;
\`;

const LoadingMessage = styled.div\`
  text-align: center;
  padding: 2rem;
  color: var(--gray-dark);
\`;

const OrdersList = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 1rem;
\`;

const EmptyState = styled.div\`
  text-align: center;
  padding: 3rem 1rem;
\`;

const EmptyStateTitle = styled.h3\`
  margin-bottom: 0.5rem;
\`;

const EmptyStateText = styled.p\`
  color: var(--gray-dark);
  margin-bottom: 1.5rem;
\`;

const ShopNowButton = styled(Link)\`
  display: inline-block;
  background-color: var(--primary-color);
  color: white;
  padding: 0.8rem 1.5rem;
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 500;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const AddAddressButton = styled.button\`
  display: inline-block;
  background-color: var(--primary-color);
  color: white;
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    background-color: #3178cf;
  }
\`;