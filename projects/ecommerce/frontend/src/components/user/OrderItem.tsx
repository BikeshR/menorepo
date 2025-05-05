import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

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

interface OrderItemProps {
  order: OrderSummary;
}

const OrderItem: React.FC<OrderItemProps> = ({ order }) => {
  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'var(--primary-color)';
      case 'shipped':
        return 'var(--warning-color)';
      case 'delivered':
        return 'var(--success-color)';
      case 'cancelled':
        return 'var(--error-color)';
      default:
        return 'var(--gray-dark)';
    }
  };
  
  return (
    <OrderItemContainer>
      <OrderHeader>
        <OrderInfo>
          <OrderNumber>{order.orderNumber}</OrderNumber>
          <OrderDate>Placed on {formatDate(order.createdAt)}</OrderDate>
        </OrderInfo>
        
        <OrderStatus color={getStatusColor(order.status)}>
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </OrderStatus>
      </OrderHeader>
      
      <OrderBody>
        <OrderSummary>
          <SummaryRow>
            <SummaryLabel>Total</SummaryLabel>
            <SummaryValue>${order.totalPrice.toFixed(2)}</SummaryValue>
          </SummaryRow>
          
          <SummaryRow>
            <SummaryLabel>Items</SummaryLabel>
            <SummaryValue>{order.items}</SummaryValue>
          </SummaryRow>
          
          <SummaryRow>
            <SummaryLabel>Payment</SummaryLabel>
            <SummaryValue>
              {order.isPaid ? (
                <StatusBadge color="var(--success-color)">Paid</StatusBadge>
              ) : (
                <StatusBadge color="var(--error-color)">Unpaid</StatusBadge>
              )}
            </SummaryValue>
          </SummaryRow>
          
          <SummaryRow>
            <SummaryLabel>Delivery</SummaryLabel>
            <SummaryValue>
              {order.isDelivered ? (
                <StatusBadge color="var(--success-color)">Delivered</StatusBadge>
              ) : (
                <StatusBadge color="var(--warning-color)">Pending</StatusBadge>
              )}
            </SummaryValue>
          </SummaryRow>
        </OrderSummary>
        
        <OrderActions>
          <OrderDetailsButton to={`/orders/${order._id}`}>
            View Details
          </OrderDetailsButton>
          
          {order.status === 'delivered' && (
            <ReviewButton>Write Review</ReviewButton>
          )}
          
          {order.status === 'processing' && (
            <CancelButton>Cancel Order</CancelButton>
          )}
        </OrderActions>
      </OrderBody>
    </OrderItemContainer>
  );
};

export default OrderItem;

// Styled Components
const OrderItemContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: box-shadow 0.2s ease;
  
  &:hover {
    box-shadow: var(--shadow-md);
  }
\`;

const OrderHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--gray-light);
  border-bottom: 1px solid var(--gray-medium);
  
  @media (max-width: 576px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
\`;

const OrderInfo = styled.div\`
  // Styles for order info container
\`;

const OrderNumber = styled.div\`
  font-weight: 500;
  margin-bottom: 0.25rem;
\`;

const OrderDate = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

interface OrderStatusProps {
  color: string;
}

const OrderStatus = styled.div<OrderStatusProps>\`
  font-weight: 500;
  color: ${(props) => props.color};
\`;

const OrderBody = styled.div\`
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
\`;

const OrderSummary = styled.div\`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
\`;

const SummaryRow = styled.div\`
  display: flex;
  flex-direction: column;
\`;

const SummaryLabel = styled.span\`
  font-size: 0.8rem;
  color: var(--gray-dark);
  margin-bottom: 0.25rem;
\`;

const SummaryValue = styled.span\`
  font-weight: 500;
\`;

interface StatusBadgeProps {
  color: string;
}

const StatusBadge = styled.span<StatusBadgeProps>\`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  color: white;
  background-color: ${(props) => props.color};
  border-radius: 20px;
\`;

const OrderActions = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
  
  @media (max-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  
  @media (max-width: 576px) {
    flex-direction: column;
    align-items: stretch;
  }
\`;

const OrderDetailsButton = styled(Link)\`
  padding: 0.6rem 1rem;
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  font-weight: 500;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const ReviewButton = styled.button\`
  padding: 0.6rem 1rem;
  background-color: white;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const CancelButton = styled.button\`
  padding: 0.6rem 1rem;
  background-color: white;
  color: var(--error-color);
  border: 1px solid var(--error-color);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    background-color: rgba(244, 67, 54, 0.1);
  }
\`;