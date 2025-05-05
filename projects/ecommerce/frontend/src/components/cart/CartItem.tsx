import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

interface CartItemProps {
  item: {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
  };
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity }) => {
  const handleRemove = () => {
    onRemove(item.id);
  };

  const handleIncrement = () => {
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  return (
    <CartItemContainer>
      <ItemImage>
        <img src={item.image} alt={item.name} />
      </ItemImage>

      <ItemDetails>
        <ItemName to={`/products/${item.id}`}>{item.name}</ItemName>
        <ItemPrice>${item.price.toFixed(2)}</ItemPrice>

        <ItemActions>
          <QuantityControl>
            <QuantityButton onClick={handleDecrement}>−</QuantityButton>
            <QuantityInput value={item.quantity} readOnly />
            <QuantityButton onClick={handleIncrement}>+</QuantityButton>
          </QuantityControl>

          <RemoveButton onClick={handleRemove}>Remove</RemoveButton>
        </ItemActions>
      </ItemDetails>

      <ItemTotal>
        ${(item.price * item.quantity).toFixed(2)}
      </ItemTotal>
    </CartItemContainer>
  );
};

export default CartItem;

// Styled Components
const CartItemContainer = styled.div\`
  display: flex;
  padding: 1rem 0;
  border-bottom: 1px solid var(--gray-light);
\`;

const ItemImage = styled.div\`
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--border-radius);
  }
\`;

const ItemDetails = styled.div\`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 1rem;
\`;

const ItemName = styled(Link)\`
  font-weight: 500;
  margin-bottom: 0.25rem;
  text-decoration: none;
  color: var(--text-color);
  
  &:hover {
    color: var(--primary-color);
  }
  
  /* Limit to 2 lines with ellipsis */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
\`;

const ItemPrice = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
  margin-bottom: 0.5rem;
\`;

const ItemActions = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
\`;

const QuantityControl = styled.div\`
  display: flex;
  align-items: center;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  overflow: hidden;
  height: 2rem;
\`;

const QuantityButton = styled.button\`
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const QuantityInput = styled.input\`
  width: 2rem;
  height: 100%;
  border: none;
  text-align: center;
  -moz-appearance: textfield;
  
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
\`;

const RemoveButton = styled.button\`
  background: none;
  border: none;
  color: var(--gray-dark);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.25rem;
  
  &:hover {
    color: var(--error-color);
  }
\`;

const ItemTotal = styled.div\`
  font-weight: 500;
  display: flex;
  align-items: flex-start;
  min-width: 70px;
  text-align: right;
\`;