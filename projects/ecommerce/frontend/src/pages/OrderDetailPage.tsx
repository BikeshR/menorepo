import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import { ordersApi } from '../services/api';
import Breadcrumb from '../components/common/Breadcrumb';

interface OrderDetails {
  _id: string;
  orderNumber: string;
  user: {
    name: string;
    email: string;
  };
  orderItems: {
    _id: string;
    name: string;
    qty: number;
    image: string;
    price: number;
    product: string;
  }[];
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
  paymentResult?: {
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };
  itemsPrice: number;
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { userInfo } = useSelector((state: RootState) => state.user);
  
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      
      try {
        // In a real app, we'd call the API
        // For demo purposes, we'll use mock data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Mock order data
        const mockOrder: OrderDetails = {
          _id: id || '1',
          orderNumber: 'ORD-12345',
          user: {
            name: userInfo?.name || 'John Doe',
            email: userInfo?.email || 'john@example.com',
          },
          orderItems: [
            {
              _id: '1',
              name: 'Wireless Headphones',
              qty: 1,
              image: 'https://via.placeholder.com/100',
              price: 79.99,
              product: '1',
            },
            {
              _id: '2',
              name: 'Smartphone Case',
              qty: 2,
              image: 'https://via.placeholder.com/100',
              price: 19.99,
              product: '2',
            },
          ],
          shippingAddress: {
            address: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            country: 'USA',
          },
          paymentMethod: 'PayPal',
          paymentResult: {
            id: 'PAY-1234567',
            status: 'COMPLETED',
            update_time: '2023-05-15T12:00:00Z',
            email_address: 'john@example.com',
          },
          itemsPrice: 119.97,
          taxPrice: 12.00,
          shippingPrice: 10.00,
          totalPrice: 141.97,
          isPaid: true,
          paidAt: '2023-05-15T12:00:00Z',
          isDelivered: false,
          status: 'shipped',
          createdAt: '2023-05-15T10:00:00Z',
          updatedAt: '2023-05-15T12:00:00Z',
        };
        
        setOrder(mockOrder);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch order details');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchOrder();
    }
  }, [id, userInfo]);
  
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
  
  // Get progress percentage based on status
  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'processing':
        return 25;
      case 'shipped':
        return 50;
      case 'delivered':
        return 100;
      case 'cancelled':
        return 0;
      default:
        return 0;
    }
  };
  
  if (isLoading) {
    return (
      <LoadingContainer>
        <LoadingMessage>Loading order details...</LoadingMessage>
      </LoadingContainer>
    );
  }
  
  if (error) {
    return (
      <ErrorContainer>
        <ErrorTitle>Error</ErrorTitle>
        <ErrorMessage>{error}</ErrorMessage>
        <BackButton to="/profile">Back to Profile</BackButton>
      </ErrorContainer>
    );
  }
  
  if (!order) {
    return (
      <ErrorContainer>
        <ErrorTitle>Order Not Found</ErrorTitle>
        <ErrorMessage>The order you are looking for does not exist.</ErrorMessage>
        <BackButton to="/profile">Back to Profile</BackButton>
      </ErrorContainer>
    );
  }
  
  return (
    <OrderDetailContainer>
      <Breadcrumb
        items={[
          { label: 'Home', path: '/' },
          { label: 'Profile', path: '/profile' },
          { label: 'Orders', path: '/profile?tab=orders' },
          { label: `Order ${order.orderNumber}`, path: '' },
        ]}
      />
      
      <OrderHeader>
        <div>
          <h1>Order {order.orderNumber}</h1>
          <OrderDate>Placed on {formatDate(order.createdAt)}</OrderDate>
        </div>
        
        <OrderStatus color={getStatusColor(order.status)}>
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </OrderStatus>
      </OrderHeader>
      
      <OrderProgressContainer>
        <OrderProgressBar>
          <ProgressFill percentage={getProgressPercentage(order.status)} />
        </OrderProgressBar>
        
        <OrderSteps>
          <OrderStep active={true}>
            <StepIcon>✓</StepIcon>
            <StepLabel>Order Placed</StepLabel>
            <StepDate>{formatDate(order.createdAt)}</StepDate>
          </OrderStep>
          
          <OrderStep active={order.status === 'shipped' || order.status === 'delivered'}>
            <StepIcon>{order.status === 'shipped' || order.status === 'delivered' ? '✓' : '⊙'}</StepIcon>
            <StepLabel>Shipped</StepLabel>
            <StepDate>
              {order.status === 'shipped' || order.status === 'delivered'
                ? formatDate(order.updatedAt)
                : 'Pending'}
            </StepDate>
          </OrderStep>
          
          <OrderStep active={order.status === 'delivered'}>
            <StepIcon>{order.status === 'delivered' ? '✓' : '⊙'}</StepIcon>
            <StepLabel>Delivered</StepLabel>
            <StepDate>
              {order.status === 'delivered'
                ? formatDate(order.deliveredAt)
                : 'Pending'}
            </StepDate>
          </OrderStep>
        </OrderSteps>
      </OrderProgressContainer>
      
      <OrderDetailsGrid>
        <OrderSection>
          <SectionTitle>Items</SectionTitle>
          <OrderItems>
            {order.orderItems.map((item) => (
              <OrderItemContainer key={item._id}>
                <ItemImage>
                  <img src={item.image} alt={item.name} />
                </ItemImage>
                
                <ItemDetails>
                  <ItemName to={`/products/${item.product}`}>
                    {item.name}
                  </ItemName>
                  <ItemQuantity>Quantity: {item.qty}</ItemQuantity>
                </ItemDetails>
                
                <ItemPrice>${(item.price * item.qty).toFixed(2)}</ItemPrice>
              </OrderItemContainer>
            ))}
          </OrderItems>
        </OrderSection>
        
        <OrderSection>
          <SectionTitle>Shipping</SectionTitle>
          <AddressContainer>
            <AddressLine>
              <strong>Address:</strong> {order.shippingAddress.address}
            </AddressLine>
            <AddressLine>
              <strong>City:</strong> {order.shippingAddress.city}
            </AddressLine>
            <AddressLine>
              <strong>Postal Code:</strong> {order.shippingAddress.postalCode}
            </AddressLine>
            <AddressLine>
              <strong>Country:</strong> {order.shippingAddress.country}
            </AddressLine>
            <AddressLine>
              <strong>Status:</strong>{' '}
              {order.isDelivered ? (
                <DeliveryStatus delivered>
                  Delivered on {formatDate(order.deliveredAt)}
                </DeliveryStatus>
              ) : (
                <DeliveryStatus delivered={false}>Not Delivered</DeliveryStatus>
              )}
            </AddressLine>
          </AddressContainer>
        </OrderSection>
        
        <OrderSection>
          <SectionTitle>Payment</SectionTitle>
          <PaymentContainer>
            <PaymentLine>
              <strong>Method:</strong> {order.paymentMethod}
            </PaymentLine>
            <PaymentLine>
              <strong>Status:</strong>{' '}
              {order.isPaid ? (
                <PaymentStatus paid>
                  Paid on {formatDate(order.paidAt)}
                </PaymentStatus>
              ) : (
                <PaymentStatus paid={false}>Not Paid</PaymentStatus>
              )}
            </PaymentLine>
            {order.paymentResult && (
              <>
                <PaymentLine>
                  <strong>Transaction ID:</strong> {order.paymentResult.id}
                </PaymentLine>
                <PaymentLine>
                  <strong>Email:</strong> {order.paymentResult.email_address}
                </PaymentLine>
              </>
            )}
          </PaymentContainer>
        </OrderSection>
        
        <OrderSection>
          <SectionTitle>Order Summary</SectionTitle>
          <OrderSummary>
            <SummaryRow>
              <SummaryLabel>Items:</SummaryLabel>
              <SummaryValue>${order.itemsPrice.toFixed(2)}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>Shipping:</SummaryLabel>
              <SummaryValue>${order.shippingPrice.toFixed(2)}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>Tax:</SummaryLabel>
              <SummaryValue>${order.taxPrice.toFixed(2)}</SummaryValue>
            </SummaryRow>
            <SummaryDivider />
            <SummaryRow>
              <SummaryTotal>Total:</SummaryTotal>
              <SummaryTotalValue>${order.totalPrice.toFixed(2)}</SummaryTotalValue>
            </SummaryRow>
          </OrderSummary>
        </OrderSection>
      </OrderDetailsGrid>
      
      <OrderActions>
        <BackToOrdersButton to="/profile">Back to Orders</BackToOrdersButton>
        {order.status === 'processing' && (
          <CancelOrderButton>Cancel Order</CancelOrderButton>
        )}
        {order.status === 'delivered' && (
          <ReviewButton>Write a Review</ReviewButton>
        )}
        <DownloadInvoiceButton>Download Invoice</DownloadInvoiceButton>
      </OrderActions>
    </OrderDetailContainer>
  );
};

export default OrderDetailPage;

// Styled Components
const OrderDetailContainer = styled.div\`
  width: 100%;
\`;

const OrderHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  
  h1 {
    margin: 0 0 0.5rem 0;
  }
  
  @media (max-width: 576px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
\`;

const OrderDate = styled.div\`
  color: var(--gray-dark);
  font-size: 0.9rem;
\`;

interface OrderStatusProps {
  color: string;
}

const OrderStatus = styled.div<OrderStatusProps>\`
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: ${(props) => props.color + '1A'}; // Add alpha for transparency
  color: ${(props) => props.color};
  font-weight: 500;
  border-radius: 20px;
\`;

const OrderProgressContainer = styled.div\`
  margin-bottom: 3rem;
\`;

const OrderProgressBar = styled.div\`
  height: 6px;
  background-color: var(--gray-light);
  border-radius: 3px;
  margin-bottom: 1rem;
  position: relative;
\`;

interface ProgressFillProps {
  percentage: number;
}

const ProgressFill = styled.div<ProgressFillProps>\`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${(props) => props.percentage}%;
  background-color: var(--primary-color);
  border-radius: 3px;
  transition: width 0.5s ease;
\`;

const OrderSteps = styled.div\`
  display: flex;
  justify-content: space-between;
\`;

interface OrderStepProps {
  active: boolean;
}

const OrderStep = styled.div<OrderStepProps>\`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-dark)')};
  
  @media (max-width: 576px) {
    flex: 1;
  }
\`;

const StepIcon = styled.div\`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: currentColor;
  color: white;
  border-radius: 50%;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
\`;

const StepLabel = styled.div\`
  font-weight: 500;
  margin-bottom: 0.25rem;
  text-align: center;
  
  @media (max-width: 576px) {
    font-size: 0.8rem;
  }
\`;

const StepDate = styled.div\`
  font-size: 0.8rem;
  text-align: center;
  
  @media (max-width: 576px) {
    font-size: 0.7rem;
  }
\`;

const OrderDetailsGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  margin-bottom: 2rem;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
\`;

const OrderSection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
\`;

const SectionTitle = styled.h2\`
  font-size: 1.2rem;
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--gray-light);
\`;

const OrderItems = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 1rem;
\`;

const OrderItemContainer = styled.div\`
  display: flex;
  align-items: center;
  
  &:not(:last-child) {
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--gray-light);
  }
\`;

const ItemImage = styled.div\`
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius);
  overflow: hidden;
  margin-right: 1rem;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
\`;

const ItemDetails = styled.div\`
  flex: 1;
\`;

const ItemName = styled(Link)\`
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  
  &:hover {
    color: var(--primary-color);
  }
\`;

const ItemQuantity = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
  margin-top: 0.25rem;
\`;

const ItemPrice = styled.div\`
  font-weight: 500;
  margin-left: 1rem;
\`;

const AddressContainer = styled.div\`
  // Styles for address container
\`;

const AddressLine = styled.div\`
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
\`;

interface DeliveryStatusProps {
  delivered: boolean;
}

const DeliveryStatus = styled.span<DeliveryStatusProps>\`
  color: ${(props) => (props.delivered ? 'var(--success-color)' : 'var(--warning-color)')};
\`;

const PaymentContainer = styled.div\`
  // Styles for payment container
\`;

const PaymentLine = styled.div\`
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
\`;

interface PaymentStatusProps {
  paid: boolean;
}

const PaymentStatus = styled.span<PaymentStatusProps>\`
  color: ${(props) => (props.paid ? 'var(--success-color)' : 'var(--error-color)')};
\`;

const OrderSummary = styled.div\`
  // Styles for order summary
\`;

const SummaryRow = styled.div\`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
\`;

const SummaryLabel = styled.div\`
  color: var(--gray-dark);
\`;

const SummaryValue = styled.div\`
  font-weight: 500;
\`;

const SummaryDivider = styled.div\`
  height: 1px;
  background-color: var(--gray-light);
  margin: 1rem 0;
\`;

const SummaryTotal = styled.div\`
  font-weight: 500;
  font-size: 1.1rem;
\`;

const SummaryTotalValue = styled.div\`
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--primary-color);
\`;

const OrderActions = styled.div\`
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  
  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
\`;

const ActionButton = styled.button\`
  padding: 0.8rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  @media (max-width: 768px) {
    flex: 1;
    min-width: 200px;
  }
\`;

const BackToOrdersButton = styled(Link)\`
  padding: 0.8rem 1.5rem;
  background-color: white;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 500;
  
  &:hover {
    background-color: var(--gray-light);
  }
  
  @media (max-width: 768px) {
    flex: 1;
    min-width: 200px;
    text-align: center;
  }
\`;

const CancelOrderButton = styled(ActionButton)\`
  background-color: white;
  color: var(--error-color);
  border: 1px solid var(--error-color);
  
  &:hover {
    background-color: rgba(244, 67, 54, 0.1);
  }
\`;

const ReviewButton = styled(ActionButton)\`
  background-color: white;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const DownloadInvoiceButton = styled(ActionButton)\`
  background-color: var(--primary-color);
  color: white;
  border: none;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const LoadingContainer = styled.div\`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
\`;

const LoadingMessage = styled.div\`
  color: var(--gray-dark);
  font-size: 1.1rem;
\`;

const ErrorContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
\`;

const ErrorTitle = styled.h2\`
  color: var(--error-color);
  margin-bottom: 1rem;
\`;

const ErrorMessage = styled.p\`
  margin-bottom: 2rem;
  color: var(--gray-dark);
\`;

const BackButton = styled(Link)\`
  display: inline-block;
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  
  &:hover {
    background-color: #3178cf;
  }
\`;