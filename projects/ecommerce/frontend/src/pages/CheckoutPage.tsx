import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../store';
import { clearCart } from '../store/slices/cartSlice';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import PaymentMethodSelector from '../components/checkout/PaymentMethodSelector';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  sameShippingAddress: boolean;
  saveInfo: boolean;
}

interface FormErrors {
  [key: string]: string;
}

type PaymentMethod = 'credit_card' | 'paypal' | 'apple_pay' | 'google_pay';

const CheckoutPage: React.FC = () => {
  const { items, totalItems, totalAmount } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    sameShippingAddress: true,
    saveInfo: false,
  });
  
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Taxes, shipping, etc.
  const taxRate = 0.1; // 10% tax
  const shippingCost = totalAmount > 100 ? 0 : 10;
  const subtotal = totalAmount;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount + shippingCost;
  
  if (items.length === 0) {
    return (
      <EmptyCartMessage>
        <h2>Your cart is empty</h2>
        <p>Add some products to your cart before checking out.</p>
        <ShopNowButton to="/products">Shop Now</ShopNowButton>
      </EmptyCartMessage>
    );
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: '',
      });
    }
  };
  
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zipCode'];
    requiredFields.forEach((field) => {
      if (!formData[field as keyof FormData]) {
        errors[field] = 'This field is required';
      }
    });
    
    // Validate email format
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Validate zip code format (US format for simplicity)
    if (formData.zipCode && !/^\d{5}(-\d{4})?$/.test(formData.zipCode)) {
      errors.zipCode = 'Please enter a valid zip code';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleContinue = () => {
    if (currentStep === 1) {
      const isValid = validateForm();
      if (isValid) {
        setCurrentStep(2);
      }
    }
  };
  
  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };
  
  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };
  
  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate API call to process order
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Clear cart after successful order
      dispatch(clearCart());
      
      // Redirect to success page
      navigate('/checkout/success', { 
        state: { 
          orderId: `ORD-${Math.floor(Math.random() * 10000)}`,
          total,
        } 
      });
    } catch (error) {
      console.error('Error processing order:', error);
      alert('There was an error processing your order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <CheckoutPageContainer>
      <PageHeader>
        <h1>Checkout</h1>
        <BreadcrumbNav>
          <Link to="/">Home</Link> / <Link to="/cart">Cart</Link> /{' '}
          <span>Checkout</span>
        </BreadcrumbNav>
      </PageHeader>
      
      <CheckoutSteps>
        <CheckoutStep active={currentStep === 1} completed={currentStep > 1}>
          <StepNumber>{currentStep > 1 ? '✓' : '1'}</StepNumber>
          <StepTitle>Shipping</StepTitle>
        </CheckoutStep>
        <StepConnector completed={currentStep > 1} />
        <CheckoutStep active={currentStep === 2} completed={currentStep > 2}>
          <StepNumber>2</StepNumber>
          <StepTitle>Payment</StepTitle>
        </CheckoutStep>
        <StepConnector completed={currentStep > 2} />
        <CheckoutStep active={currentStep === 3} completed={currentStep > 3}>
          <StepNumber>3</StepNumber>
          <StepTitle>Confirmation</StepTitle>
        </CheckoutStep>
      </CheckoutSteps>
      
      <CheckoutContent>
        <CheckoutMain>
          {currentStep === 1 && (
            <ShippingForm>
              <SectionTitle>Shipping Information</SectionTitle>
              
              <FormRow>
                <FormGroup>
                  <Label htmlFor="firstName">First Name*</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    hasError={!!formErrors.firstName}
                  />
                  {formErrors.firstName && <ErrorMessage>{formErrors.firstName}</ErrorMessage>}
                </FormGroup>
                
                <FormGroup>
                  <Label htmlFor="lastName">Last Name*</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    hasError={!!formErrors.lastName}
                  />
                  {formErrors.lastName && <ErrorMessage>{formErrors.lastName}</ErrorMessage>}
                </FormGroup>
              </FormRow>
              
              <FormRow>
                <FormGroup>
                  <Label htmlFor="email">Email Address*</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    hasError={!!formErrors.email}
                  />
                  {formErrors.email && <ErrorMessage>{formErrors.email}</ErrorMessage>}
                </FormGroup>
                
                <FormGroup>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </FormGroup>
              </FormRow>
              
              <FormGroup>
                <Label htmlFor="address">Address*</Label>
                <Input
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange}
                  hasError={!!formErrors.address}
                />
                {formErrors.address && <ErrorMessage>{formErrors.address}</ErrorMessage>}
              </FormGroup>
              
              <FormRow>
                <FormGroup>
                  <Label htmlFor="city">City*</Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    value={formData.city}
                    onChange={handleInputChange}
                    hasError={!!formErrors.city}
                  />
                  {formErrors.city && <ErrorMessage>{formErrors.city}</ErrorMessage>}
                </FormGroup>
                
                <FormGroup>
                  <Label htmlFor="state">State/Province*</Label>
                  <Input
                    id="state"
                    name="state"
                    type="text"
                    value={formData.state}
                    onChange={handleInputChange}
                    hasError={!!formErrors.state}
                  />
                  {formErrors.state && <ErrorMessage>{formErrors.state}</ErrorMessage>}
                </FormGroup>
              </FormRow>
              
              <FormRow>
                <FormGroup>
                  <Label htmlFor="zipCode">Zip Code*</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    type="text"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    hasError={!!formErrors.zipCode}
                  />
                  {formErrors.zipCode && <ErrorMessage>{formErrors.zipCode}</ErrorMessage>}
                </FormGroup>
                
                <FormGroup>
                  <Label htmlFor="country">Country*</Label>
                  <Select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="UK">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </Select>
                </FormGroup>
              </FormRow>
              
              <CheckboxGroup>
                <Checkbox
                  id="sameShippingAddress"
                  name="sameShippingAddress"
                  checked={formData.sameShippingAddress}
                  onChange={handleInputChange}
                />
                <CheckboxLabel htmlFor="sameShippingAddress">
                  Billing address same as shipping address
                </CheckboxLabel>
              </CheckboxGroup>
              
              <CheckboxGroup>
                <Checkbox
                  id="saveInfo"
                  name="saveInfo"
                  checked={formData.saveInfo}
                  onChange={handleInputChange}
                />
                <CheckboxLabel htmlFor="saveInfo">
                  Save this information for next time
                </CheckboxLabel>
              </CheckboxGroup>
              
              <FormActions>
                <BackButton as={Link} to="/cart">
                  Return to Cart
                </BackButton>
                <ContinueButton onClick={handleContinue}>
                  Continue to Payment
                </ContinueButton>
              </FormActions>
            </ShippingForm>
          )}
          
          {currentStep === 2 && (
            <PaymentForm>
              <SectionTitle>Payment Method</SectionTitle>
              
              <PaymentMethodSelector
                selectedMethod={paymentMethod}
                onSelectMethod={handlePaymentMethodChange}
              />
              
              {paymentMethod === 'credit_card' && (
                <CreditCardForm>
                  <FormGroup>
                    <Label htmlFor="cardName">Name on Card*</Label>
                    <Input
                      id="cardName"
                      name="cardName"
                      type="text"
                      placeholder="John Doe"
                    />
                  </FormGroup>
                  
                  <FormGroup>
                    <Label htmlFor="cardNumber">Card Number*</Label>
                    <Input
                      id="cardNumber"
                      name="cardNumber"
                      type="text"
                      placeholder="•••• •••• •••• ••••"
                    />
                  </FormGroup>
                  
                  <FormRow>
                    <FormGroup>
                      <Label htmlFor="expiryDate">Expiry Date*</Label>
                      <Input
                        id="expiryDate"
                        name="expiryDate"
                        type="text"
                        placeholder="MM/YY"
                      />
                    </FormGroup>
                    
                    <FormGroup>
                      <Label htmlFor="cvc">CVC*</Label>
                      <Input
                        id="cvc"
                        name="cvc"
                        type="text"
                        placeholder="•••"
                      />
                    </FormGroup>
                  </FormRow>
                </CreditCardForm>
              )}
              
              <FormActions>
                <BackButton onClick={handleBack}>
                  Return to Shipping
                </BackButton>
                <ContinueButton 
                  onClick={handlePlaceOrder} 
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Place Order'}
                </ContinueButton>
              </FormActions>
            </PaymentForm>
          )}
        </CheckoutMain>
        
        <CheckoutSidebar>
          <CheckoutSummary
            items={items}
            subtotal={subtotal}
            tax={taxAmount}
            shipping={shippingCost}
            total={total}
          />
        </CheckoutSidebar>
      </CheckoutContent>
    </CheckoutPageContainer>
  );
};

export default CheckoutPage;

// Styled Components
const CheckoutPageContainer = styled.div\`
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

const CheckoutSteps = styled.div\`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
\`;

interface StepProps {
  active: boolean;
  completed: boolean;
}

const CheckoutStep = styled.div<StepProps>\`
  display: flex;
  align-items: center;
  
  ${({ active, completed }) => {
    if (completed) {
      return \`
        color: var(--success-color);
      \`;
    }
    if (active) {
      return \`
        color: var(--primary-color);
        font-weight: 500;
      \`;
    }
    return \`
      color: var(--gray-dark);
    \`;
  }}
\`;

const StepNumber = styled.div\`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: currentColor;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  margin-right: 0.5rem;
\`;

const StepTitle = styled.div\`
  font-size: 1rem;
\`;

interface ConnectorProps {
  completed: boolean;
}

const StepConnector = styled.div<ConnectorProps>\`
  height: 2px;
  width: 50px;
  background-color: ${(props) => (props.completed ? 'var(--success-color)' : 'var(--gray-medium)')};
  margin: 0 0.5rem;
  
  @media (max-width: 576px) {
    width: 20px;
  }
\`;

const CheckoutContent = styled.div\`
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
\`;

const CheckoutMain = styled.div\`
  // Styles for the main checkout area
\`;

const CheckoutSidebar = styled.div\`
  @media (max-width: 992px) {
    order: -1;
  }
\`;

const SectionTitle = styled.h2\`
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
\`;

const ShippingForm = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
\`;

const PaymentForm = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 2rem;
\`;

const CreditCardForm = styled.div\`
  margin-top: 1.5rem;
\`;

const FormRow = styled.div\`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
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

const Select = styled.select\`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  font-size: 1rem;
  background-color: white;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(58, 134, 255, 0.2);
  }
\`;

const ErrorMessage = styled.div\`
  color: var(--error-color);
  font-size: 0.8rem;
  margin-top: 0.25rem;
\`;

const CheckboxGroup = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
\`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })\`
  margin-right: 0.5rem;
\`;

const CheckboxLabel = styled.label\`
  font-size: 0.9rem;
\`;

const FormActions = styled.div\`
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  
  @media (max-width: 576px) {
    flex-direction: column;
    gap: 1rem;
  }
\`;

const ActionButton = styled.button\`
  padding: 0.8rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  @media (max-width: 576px) {
    width: 100%;
  }
\`;

const BackButton = styled(ActionButton)\`
  background-color: white;
  color: var(--text-color);
  border: 1px solid var(--gray-medium);
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const ContinueButton = styled(ActionButton)\`
  background-color: var(--primary-color);
  color: white;
  border: none;
  
  &:hover:not(:disabled) {
    background-color: #3178cf;
  }
  
  &:disabled {
    background-color: var(--gray-medium);
    cursor: not-allowed;
  }
\`;

const EmptyCartMessage = styled.div\`
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