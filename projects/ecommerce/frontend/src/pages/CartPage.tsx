import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../store';
import { removeFromCart, updateQuantity, clearCart } from '../store/slices/cartSlice';
import CartItem from '../components/cart/CartItem';

const CartPage: React.FC = () => {
  const { items, totalItems, totalAmount } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  
  const taxRate = 0.1; // 10% tax
  const shippingCost = totalAmount > 100 ? 0 : 10;
  
  const handleRemoveItem = (id: string) => {
    dispatch(removeFromCart(id));
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    dispatch(updateQuantity({ id, quantity }));
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      dispatch(clearCart());
    }
  };

  const handleApplyCoupon = () => {
    // Simulate coupon application
    if (couponCode.toUpperCase() === 'SAVE10') {
      setCouponApplied(true);
      setCouponDiscount(totalAmount * 0.1);
    } else {
      alert('Invalid coupon code');
    }
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const subtotal = totalAmount;
  const taxAmount = subtotal * taxRate;
  const discountAmount = couponApplied ? couponDiscount : 0;
  const total = subtotal + taxAmount + shippingCost - discountAmount;

  return (
    <CartPageContainer>
      <PageHeader>
        <h1>Shopping Cart</h1>
        <BreadcrumbNav>
          <Link to="/">Home</Link> / <span>Cart</span>
        </BreadcrumbNav>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyCartMessage>
          <h2>Your cart is empty</h2>
          <p>Add some items to your cart to see them here.</p>
          <ShopNowButton to="/products">Shop Now</ShopNowButton>
        </EmptyCartMessage>
      ) : (
        <CartContent>
          <CartItemsSection>
            <CartHeader>
              <CartColumnLabel style={{ flex: '1' }}>Product</CartColumnLabel>
              <CartColumnLabel style={{ width: '100px', textAlign: 'center' }}>Price</CartColumnLabel>
              <CartColumnLabel style={{ width: '150px', textAlign: 'center' }}>Quantity</CartColumnLabel>
              <CartColumnLabel style={{ width: '100px', textAlign: 'right' }}>Total</CartColumnLabel>
            </CartHeader>
            
            <CartItemsList>
              {items.map((item) => (
                <CartItemWrapper key={item.id}>
                  <CartItem
                    item={item}
                    onRemove={handleRemoveItem}
                    onUpdateQuantity={handleUpdateQuantity}
                  />
                </CartItemWrapper>
              ))}
            </CartItemsList>
            
            <CartActions>
              <Link to="/products">Continue Shopping</Link>
              <ClearCartButton onClick={handleClearCart}>Clear Cart</ClearCartButton>
            </CartActions>
          </CartItemsSection>

          <CartSummarySection>
            <CartSummaryTitle>Order Summary</CartSummaryTitle>
            
            <CartSummaryRow>
              <span>Items ({totalItems}):</span>
              <span>${subtotal.toFixed(2)}</span>
            </CartSummaryRow>
            
            <CartSummaryRow>
              <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
              <span>${taxAmount.toFixed(2)}</span>
            </CartSummaryRow>
            
            <CartSummaryRow>
              <span>Shipping:</span>
              <span>
                {shippingCost === 0 ? (
                  <FreeShipping>FREE</FreeShipping>
                ) : (
                  `$${shippingCost.toFixed(2)}`
                )}
              </span>
            </CartSummaryRow>
            
            {couponApplied && (
              <CartSummaryRow isDiscount>
                <span>Discount:</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </CartSummaryRow>
            )}
            
            <TotalRow>
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </TotalRow>
            
            <CouponSection>
              <CouponLabel>Apply Coupon Code</CouponLabel>
              <CouponInputGroup>
                <CouponInput
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  disabled={couponApplied}
                />
                <CouponButton
                  onClick={handleApplyCoupon}
                  disabled={couponApplied || !couponCode}
                >
                  Apply
                </CouponButton>
              </CouponInputGroup>
              {couponApplied && (
                <CouponSuccess>Coupon applied successfully!</CouponSuccess>
              )}
            </CouponSection>
            
            <CheckoutButton onClick={handleCheckout}>
              Proceed to Checkout
            </CheckoutButton>
            
            <SecureCheckout>
              <SecureIcon>🔒</SecureIcon>
              Secure Checkout
            </SecureCheckout>
          </CartSummarySection>
        </CartContent>
      )}
    </CartPageContainer>
  );
};

export default CartPage;

// Styled Components
const CartPageContainer = styled.div\`
  width: 100%;
\`;

const PageHeader = styled.div\`
  margin-bottom: 2rem;
  
  h1 {
    margin-bottom: 0.5rem;
  }
\`;

const BreadcrumbNav = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
  
  a {
    color: var(--gray-dark);
    text-decoration: none;
    
    &:hover {
      color: var(--primary-color);
    }
  }
\`;

const EmptyCartMessage = styled.div\`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1rem;
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  
  h2 {
    margin-bottom: 1rem;
  }
  
  p {
    color: var(--gray-dark);
    margin-bottom: 2rem;
  }
\`;

const ShopNowButton = styled(Link)\`
  padding: 0.8rem 2rem;
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const CartContent = styled.div\`
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
\`;

const CartItemsSection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
\`;

const CartHeader = styled.div\`
  display: flex;
  align-items: center;
  padding: 1rem;
  background-color: var(--gray-light);
  border-bottom: 1px solid var(--gray-medium);
  
  @media (max-width: 768px) {
    display: none;
  }
\`;

const CartColumnLabel = styled.span\`
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const CartItemsList = styled.div\`
  padding: 1rem;
\`;

const CartItemWrapper = styled.div\`
  &:not(:last-child) {
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--gray-light);
  }
\`;

const CartActions = styled.div\`
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  border-top: 1px solid var(--gray-light);
  
  a {
    color: var(--primary-color);
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
\`;

const ClearCartButton = styled.button\`
  background: none;
  border: none;
  color: var(--error-color);
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
\`;

const CartSummarySection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  height: fit-content;
\`;

const CartSummaryTitle = styled.h2\`
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--gray-light);
\`;

interface CartSummaryRowProps {
  isDiscount?: boolean;
}

const CartSummaryRow = styled.div<CartSummaryRowProps>\`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  color: ${props => props.isDiscount ? 'var(--success-color)' : 'inherit'};
  
  span:first-child {
    color: var(--gray-dark);
  }
\`;

const TotalRow = styled.div\`
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  font-size: 1.2rem;
  margin: 1.5rem 0;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-medium);
\`;

const FreeShipping = styled.span\`
  color: var(--success-color);
  font-weight: 500;
\`;

const CouponSection = styled.div\`
  margin-bottom: 1.5rem;
\`;

const CouponLabel = styled.label\`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const CouponInputGroup = styled.div\`
  display: flex;
  margin-bottom: 0.5rem;
\`;

const CouponInput = styled.input\`
  flex: 1;
  padding: 0.6rem;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius) 0 0 var(--border-radius);
  
  &:disabled {
    background-color: var(--gray-light);
  }
\`;

const CouponButton = styled.button\`
  padding: 0.6rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: #3178cf;
  }
  
  &:disabled {
    background-color: var(--gray-dark);
    cursor: not-allowed;
  }
\`;

const CouponSuccess = styled.div\`
  font-size: 0.8rem;
  color: var(--success-color);
\`;

const CheckoutButton = styled.button\`
  width: 100%;
  padding: 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const SecureCheckout = styled.div\`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--gray-dark);
\`;

const SecureIcon = styled.span\`
  margin-right: 0.5rem;
\`;