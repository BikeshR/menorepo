import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../../store';
import { removeFromCart, updateQuantity, toggleCart } from '../../store/slices/cartSlice';
import CartItem from './CartItem';

const CartPopup: React.FC = () => {
  const { items, totalItems, totalAmount } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleRemoveItem = (id: string) => {
    dispatch(removeFromCart(id));
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    dispatch(updateQuantity({ id, quantity }));
  };

  const handleCheckout = () => {
    dispatch(toggleCart());
    navigate('/checkout');
  };

  const handleViewCart = () => {
    dispatch(toggleCart());
    navigate('/cart');
  };

  const handleCloseCart = () => {
    dispatch(toggleCart());
  };

  return (
    <CartPopupContainer>
      <CartPopupOverlay onClick={handleCloseCart} />
      
      <CartPopupContent>
        <CartHeader>
          <CartTitle>Your Cart ({totalItems} items)</CartTitle>
          <CloseButton onClick={handleCloseCart}>✕</CloseButton>
        </CartHeader>

        <CartBody>
          {items.length === 0 ? (
            <EmptyCart>
              <p>Your cart is empty</p>
              <EmptyCartLink to="/products" onClick={handleCloseCart}>
                Continue Shopping
              </EmptyCartLink>
            </EmptyCart>
          ) : (
            <>
              <CartItemsList>
                {items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveItem}
                    onUpdateQuantity={handleUpdateQuantity}
                  />
                ))}
              </CartItemsList>
              
              <CartSummary>
                <SubtotalRow>
                  <span>Subtotal:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </SubtotalRow>
                <TaxRow>
                  <span>Tax (estimated):</span>
                  <span>${(totalAmount * 0.1).toFixed(2)}</span>
                </TaxRow>
                <TotalRow>
                  <span>Total:</span>
                  <span>${(totalAmount * 1.1).toFixed(2)}</span>
                </TotalRow>
              </CartSummary>
            </>
          )}
        </CartBody>

        {items.length > 0 && (
          <CartFooter>
            <ViewCartButton onClick={handleViewCart}>View Cart</ViewCartButton>
            <CheckoutButton onClick={handleCheckout}>Checkout</CheckoutButton>
          </CartFooter>
        )}
      </CartPopupContent>
    </CartPopupContainer>
  );
};

export default CartPopup;

// Styled Components
const CartPopupContainer = styled.div\`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
\`;

const CartPopupOverlay = styled.div\`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.5);
\`;

const CartPopupContent = styled.div\`
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 100%;
  background-color: white;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 10px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease-in-out;
  z-index: 1;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
\`;

const CartHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--gray-medium);
\`;

const CartTitle = styled.h2\`
  font-size: 1.2rem;
  margin: 0;
\`;

const CloseButton = styled.button\`
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--gray-dark);
  transition: color 0.2s ease;

  &:hover {
    color: var(--text-color);
  }
\`;

const CartBody = styled.div\`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
\`;

const EmptyCart = styled.div\`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--gray-dark);
  
  p {
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }
\`;

const EmptyCartLink = styled(Link)\`
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const CartItemsList = styled.div\`
  flex: 1;
\`;

const CartSummary = styled.div\`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-medium);
\`;

const SummaryRow = styled.div\`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
\`;

const SubtotalRow = styled(SummaryRow)\`
  font-size: 0.9rem;
\`;

const TaxRow = styled(SummaryRow)\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const TotalRow = styled(SummaryRow)\`
  font-weight: bold;
  font-size: 1.1rem;
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--gray-medium);
\`;

const CartFooter = styled.div\`
  padding: 1rem;
  border-top: 1px solid var(--gray-medium);
  display: flex;
  gap: 0.5rem;
\`;

const CartButton = styled.button\`
  flex: 1;
  padding: 0.8rem;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
\`;

const ViewCartButton = styled(CartButton)\`
  background-color: white;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const CheckoutButton = styled(CartButton)\`
  background-color: var(--primary-color);
  color: white;
  
  &:hover {
    background-color: #3178cf;
  }
\`;