import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../store';
import { 
  fetchWishlist, 
  removeFromWishlist, 
  clearWishlist,
  removeItemLocally,
  clearItemsLocally
} from '../store/slices/wishlistSlice';
import { addToCart } from '../store/slices/cartSlice';
import ProductCard from '../components/products/ProductCard';
import Breadcrumb from '../components/common/Breadcrumb';

const WishlistPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { items: wishlistItems, isLoading, error } = useSelector(
    (state: RootState) => state.wishlist
  );
  const { userInfo } = useSelector((state: RootState) => state.user);
  
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  
  // Fetch wishlist on mount
  useEffect(() => {
    // If API is available, use the thunk
    // dispatch(fetchWishlist());
    
    // For demo purposes, we'll use the local state that was already set
  }, [dispatch]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userInfo) {
      navigate('/login');
    }
  }, [userInfo, navigate]);
  
  const handleRemoveFromWishlist = (productId: string) => {
    // If API is available, use the thunk
    // dispatch(removeFromWishlist(productId));
    
    // For demo purposes, use local action
    dispatch(removeItemLocally(productId));
  };
  
  const handleAddToCart = (product: any) => {
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      })
    );
    
    // Show success toast
    alert(`${product.name} added to cart!`);
  };
  
  const handleClearWishlist = () => {
    // If API is available, use the thunk
    // dispatch(clearWishlist());
    
    // For demo purposes, use local action
    dispatch(clearItemsLocally());
    setShowConfirmClear(false);
  };
  
  return (
    <WishlistPageContainer>
      <Breadcrumb
        items={[
          { label: 'Home', path: '/' },
          { label: 'Wishlist', path: '/wishlist' },
        ]}
      />
      
      <WishlistHeader>
        <h1>My Wishlist</h1>
        
        {wishlistItems.length > 0 && (
          <WishlistActions>
            <ClearWishlistButton onClick={() => setShowConfirmClear(true)}>
              Clear Wishlist
            </ClearWishlistButton>
          </WishlistActions>
        )}
      </WishlistHeader>
      
      {isLoading ? (
        <LoadingState>Loading wishlist...</LoadingState>
      ) : error ? (
        <ErrorState>{error}</ErrorState>
      ) : wishlistItems.length === 0 ? (
        <EmptyWishlist>
          <EmptyWishlistTitle>Your wishlist is empty</EmptyWishlistTitle>
          <EmptyWishlistText>
            Save items you're interested in by clicking the heart icon on product pages.
          </EmptyWishlistText>
          <ExploreButton to="/products">Explore Products</ExploreButton>
        </EmptyWishlist>
      ) : (
        <>
          <WishlistSummary>
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} in your wishlist
          </WishlistSummary>
          
          <WishlistGrid>
            {wishlistItems.map((product) => (
              <WishlistItem key={product.id}>
                <ProductCard product={product} />
                <WishlistItemActions>
                  <AddToCartButton onClick={() => handleAddToCart(product)}>
                    Add to Cart
                  </AddToCartButton>
                  <RemoveButton onClick={() => handleRemoveFromWishlist(product.id)}>
                    Remove
                  </RemoveButton>
                </WishlistItemActions>
              </WishlistItem>
            ))}
          </WishlistGrid>
        </>
      )}
      
      {showConfirmClear && (
        <ConfirmDialog>
          <ConfirmDialogContent>
            <ConfirmTitle>Clear Wishlist?</ConfirmTitle>
            <ConfirmText>
              Are you sure you want to remove all items from your wishlist?
              This action cannot be undone.
            </ConfirmText>
            <ConfirmActions>
              <CancelButton onClick={() => setShowConfirmClear(false)}>
                Cancel
              </CancelButton>
              <ConfirmButton onClick={handleClearWishlist}>
                Clear Wishlist
              </ConfirmButton>
            </ConfirmActions>
          </ConfirmDialogContent>
          <ConfirmDialogOverlay onClick={() => setShowConfirmClear(false)} />
        </ConfirmDialog>
      )}
    </WishlistPageContainer>
  );
};

export default WishlistPage;

// Styled Components
const WishlistPageContainer = styled.div\`
  width: 100%;
\`;

const WishlistHeader = styled.div\`
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
    gap: 1rem;
  }
\`;

const WishlistActions = styled.div\`
  // Styles for wishlist actions
\`;

const ClearWishlistButton = styled.button\`
  padding: 0.6rem 1rem;
  background-color: white;
  color: var(--error-color);
  border: 1px solid var(--error-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    background-color: rgba(244, 67, 54, 0.1);
  }
\`;

const LoadingState = styled.div\`
  text-align: center;
  padding: 3rem;
  color: var(--gray-dark);
  font-size: 1.1rem;
\`;

const ErrorState = styled.div\`
  text-align: center;
  padding: 2rem;
  color: var(--error-color);
  background-color: rgba(244, 67, 54, 0.1);
  border-radius: var(--border-radius);
\`;

const EmptyWishlist = styled.div\`
  text-align: center;
  padding: 3rem 1rem;
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
\`;

const EmptyWishlistTitle = styled.h2\`
  margin-bottom: 0.5rem;
\`;

const EmptyWishlistText = styled.p\`
  color: var(--gray-dark);
  margin-bottom: 1.5rem;
\`;

const ExploreButton = styled(Link)\`
  display: inline-block;
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 500;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const WishlistSummary = styled.div\`
  margin-bottom: 1.5rem;
  color: var(--gray-dark);
\`;

const WishlistGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2rem;
  
  @media (max-width: 576px) {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }
\`;

const WishlistItem = styled.div\`
  // For animation effects or additional styling
\`;

const WishlistItemActions = styled.div\`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  
  @media (max-width: 576px) {
    flex-direction: column;
  }
\`;

const AddToCartButton = styled.button\`
  flex: 1;
  padding: 0.6rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const RemoveButton = styled.button\`
  padding: 0.6rem;
  background-color: white;
  color: var(--gray-dark);
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
    color: var(--error-color);
  }
\`;

const ConfirmDialog = styled.div\`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
\`;

const ConfirmDialogOverlay = styled.div\`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
\`;

const ConfirmDialogContent = styled.div\`
  position: relative;
  background-color: white;
  border-radius: var(--border-radius);
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  z-index: 1;
  box-shadow: var(--shadow-lg);
\`;

const ConfirmTitle = styled.h3\`
  margin-bottom: 1rem;
\`;

const ConfirmText = styled.p\`
  margin-bottom: 1.5rem;
  color: var(--gray-dark);
\`;

const ConfirmActions = styled.div\`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
\`;

const CancelButton = styled.button\`
  padding: 0.6rem 1rem;
  background-color: white;
  color: var(--text-color);
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const ConfirmButton = styled.button\`
  padding: 0.6rem 1rem;
  background-color: var(--error-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  
  &:hover {
    opacity: 0.9;
  }
\`;