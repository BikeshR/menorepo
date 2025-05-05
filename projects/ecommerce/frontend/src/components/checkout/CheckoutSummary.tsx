import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

interface CheckoutSummaryProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  items,
  subtotal,
  tax,
  shipping,
  total,
}) => {
  return (
    <SummaryContainer>
      <SummaryTitle>Order Summary</SummaryTitle>
      
      <ItemsList>
        {items.map((item) => (
          <SummaryItem key={item.id}>
            <ItemImageContainer>
              <ItemImage src={item.image} alt={item.name} />
              <ItemQuantity>{item.quantity}</ItemQuantity>
            </ItemImageContainer>
            
            <ItemDetails>
              <ItemName to={`/products/${item.id}`}>{item.name}</ItemName>
              <ItemPrice>${item.price.toFixed(2)}</ItemPrice>
            </ItemDetails>
            
            <ItemTotal>${(item.price * item.quantity).toFixed(2)}</ItemTotal>
          </SummaryItem>
        ))}
      </ItemsList>
      
      <Divider />
      
      <SummaryRow>
        <RowLabel>Subtotal</RowLabel>
        <RowValue>${subtotal.toFixed(2)}</RowValue>
      </SummaryRow>
      
      <SummaryRow>
        <RowLabel>Tax</RowLabel>
        <RowValue>${tax.toFixed(2)}</RowValue>
      </SummaryRow>
      
      <SummaryRow>
        <RowLabel>Shipping</RowLabel>
        <RowValue>
          {shipping === 0 ? (
            <FreeShipping>FREE</FreeShipping>
          ) : (
            `$${shipping.toFixed(2)}`
          )}
        </RowValue>
      </SummaryRow>
      
      <Divider />
      
      <TotalRow>
        <TotalLabel>Total</TotalLabel>
        <TotalValue>${total.toFixed(2)}</TotalValue>
      </TotalRow>
      
      <SecurityNote>
        <SecurityIcon>🔒</SecurityIcon>
        <SecurityText>
          All transactions are secure and encrypted. Your payment information is never stored.
        </SecurityText>
      </SecurityNote>
    </SummaryContainer>
  );
};

export default CheckoutSummary;

// Styled Components
const SummaryContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
\`;

const SummaryTitle = styled.h2\`
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--gray-light);
\`;

const ItemsList = styled.div\`
  margin-bottom: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
\`;

const SummaryItem = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
\`;

const ItemImageContainer = styled.div\`
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius);
  overflow: hidden;
  margin-right: 1rem;
\`;

const ItemImage = styled.img\`
  width: 100%;
  height: 100%;
  object-fit: cover;
\`;

const ItemQuantity = styled.div\`
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: var(--primary-color);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
\`;

const ItemDetails = styled.div\`
  flex: 1;
  min-width: 0;
\`;

const ItemName = styled(Link)\`
  display: block;
  font-weight: 500;
  margin-bottom: 0.25rem;
  text-decoration: none;
  color: var(--text-color);
  
  /* Truncate text if too long */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  &:hover {
    color: var(--primary-color);
  }
\`;

const ItemPrice = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const ItemTotal = styled.div\`
  font-weight: 500;
  margin-left: 0.5rem;
\`;

const Divider = styled.div\`
  height: 1px;
  background-color: var(--gray-light);
  margin: 1rem 0;
\`;

const SummaryRow = styled.div\`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.8rem;
\`;

const RowLabel = styled.div\`
  color: var(--gray-dark);
\`;

const RowValue = styled.div\`
  font-weight: 500;
\`;

const FreeShipping = styled.span\`
  color: var(--success-color);
\`;

const TotalRow = styled.div\`
  display: flex;
  justify-content: space-between;
  margin: 1.5rem 0;
  font-size: 1.2rem;
\`;

const TotalLabel = styled.div\`
  font-weight: 500;
\`;

const TotalValue = styled.div\`
  font-weight: bold;
  color: var(--primary-color);
\`;

const SecurityNote = styled.div\`
  display: flex;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-light);
  font-size: 0.8rem;
  color: var(--gray-dark);
\`;

const SecurityIcon = styled.span\`
  margin-right: 0.5rem;
\`;

const SecurityText = styled.div\`
  line-height: 1.4;
\`;