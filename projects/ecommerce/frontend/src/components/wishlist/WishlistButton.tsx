import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { RootState } from '../../store';
import { 
  addToWishlist, 
  removeFromWishlist, 
  selectIsInWishlist,
  addItemLocally,
  removeItemLocally 
} from '../../store/slices/wishlistSlice';
import { Product } from '../../store/slices/productSlice';

interface WishlistButtonProps {
  product: Product;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

const WishlistButton: React.FC<WishlistButtonProps> = ({
  product,
  size = 'medium',
  showText = false,
  className,
}) => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state: RootState) => state.user);
  const isInWishlist = useSelector(selectIsInWishlist(product.id));
  
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Hide tooltip after 2 seconds
  useEffect(() => {
    let tooltipTimer: NodeJS.Timeout;
    
    if (showTooltip) {
      tooltipTimer = setTimeout(() => {
        setShowTooltip(false);
      }, 2000);
    }
    
    return () => {
      if (tooltipTimer) clearTimeout(tooltipTimer);
    };
  }, [showTooltip]);
  
  const handleToggleWishlist = () => {
    if (!userInfo) {
      // Show login tooltip
      setShowTooltip(true);
      return;
    }
    
    setIsAddingToWishlist(true);
    
    if (isInWishlist) {
      // Remove from wishlist
      // If API is available, use the thunk
      // dispatch(removeFromWishlist(product.id))
      
      // For demo purposes, use local action
      dispatch(removeItemLocally(product.id));
    } else {
      // Add to wishlist
      // If API is available, use the thunk
      // dispatch(addToWishlist(product.id))
      
      // For demo purposes, use local action
      dispatch(addItemLocally(product));
    }
    
    // Simulate API call delay
    setTimeout(() => {
      setIsAddingToWishlist(false);
    }, 500);
  };
  
  return (
    <WishlistButtonContainer
      className={className}
      size={size}
      onClick={handleToggleWishlist}
      isActive={isInWishlist}
      disabled={isAddingToWishlist}
    >
      <HeartIcon isActive={isInWishlist}>
        {isInWishlist ? '♥' : '♡'}
      </HeartIcon>
      
      {showText && (
        <ButtonText>
          {isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
        </ButtonText>
      )}
      
      {showTooltip && !userInfo && (
        <Tooltip>Please log in to save items to your wishlist</Tooltip>
      )}
    </WishlistButtonContainer>
  );
};

export default WishlistButton;

// Styled Components
interface WishlistButtonContainerProps {
  size: 'small' | 'medium' | 'large';
  isActive: boolean;
}

const WishlistButtonContainer = styled.button<WishlistButtonContainerProps>\`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => (props.isActive ? 'rgba(255, 0, 68, 0.1)' : 'white')};
  border: 1px solid ${(props) => (props.isActive ? 'transparent' : 'var(--gray-medium)')};
  color: ${(props) => (props.isActive ? 'var(--secondary-color)' : 'var(--text-color)')};
  border-radius: ${(props) => (props.size === 'small' ? '50%' : 'var(--border-radius)')};
  cursor: pointer;
  transition: all 0.2s ease;
  
  width: ${(props) => {
    switch (props.size) {
      case 'small':
        return '2rem';
      case 'large':
        return '3rem';
      case 'medium':
      default:
        return '2.5rem';
    }
  }};
  
  height: ${(props) => {
    switch (props.size) {
      case 'small':
        return '2rem';
      case 'large':
        return '3rem';
      case 'medium':
      default:
        return '2.5rem';
    }
  }};
  
  padding: ${(props) => props.children && props.children[1] ? '0.5rem 1rem' : '0'};
  
  &:hover {
    background-color: ${(props) => 
      props.isActive ? 'rgba(255, 0, 68, 0.15)' : 'var(--gray-light)'};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
\`;

interface HeartIconProps {
  isActive: boolean;
}

const HeartIcon = styled.span<HeartIconProps>\`
  font-size: ${(props) => (props.isActive ? '1.3rem' : '1.5rem')};
  line-height: 1;
  color: ${(props) => (props.isActive ? 'var(--secondary-color)' : 'inherit')};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
\`;

const ButtonText = styled.span\`
  margin-left: 0.5rem;
  font-size: 0.9rem;
\`;

const Tooltip = styled.div\`
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--text-color);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  font-size: 0.8rem;
  white-space: nowrap;
  z-index: 10;
  box-shadow: var(--shadow-md);
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: var(--text-color) transparent transparent transparent;
  }
\`;