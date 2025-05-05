import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { RootState } from '../store';
import { addToCart } from '../store/slices/cartSlice';
import { Product } from '../store/slices/productSlice';
import StarRating from '../components/common/StarRating';
import QuantitySelector from '../components/common/QuantitySelector';
import ProductTabs from '../components/products/ProductTabs';
import ProductImageGallery from '../components/products/ProductImageGallery';
import RelatedProducts from '../components/products/RelatedProducts';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { items: products, isLoading, error } = useSelector(
    (state: RootState) => state.products
  );
  
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Sample product images (in a real app, these would come from the product data)
  const productImages = [
    { id: 1, src: product?.image || '', alt: product?.name || '' },
    { id: 2, src: 'https://via.placeholder.com/600x400?text=Product+Image+2', alt: 'Product view 2' },
    { id: 3, src: 'https://via.placeholder.com/600x400?text=Product+Image+3', alt: 'Product view 3' },
    { id: 4, src: 'https://via.placeholder.com/600x400?text=Product+Image+4', alt: 'Product view 4' },
  ];
  
  useEffect(() => {
    if (id && products.length > 0) {
      const foundProduct = products.find((p) => p.id === id);
      if (foundProduct) {
        setProduct(foundProduct);
      }
    }
  }, [id, products]);
  
  useEffect(() => {
    // Scroll to top when product changes
    window.scrollTo(0, 0);
  }, [id]);
  
  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
  };
  
  const handleAddToCart = () => {
    if (product) {
      dispatch(
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
        })
      );
      
      // Show a success message or open cart popup
      alert(`${product.name} added to cart!`);
    }
  };
  
  const handleBuyNow = () => {
    if (product) {
      dispatch(
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
        })
      );
      
      navigate('/checkout');
    }
  };
  
  if (isLoading) {
    return <LoadingText>Loading product details...</LoadingText>;
  }
  
  if (error) {
    return <ErrorText>{error}</ErrorText>;
  }
  
  if (!product) {
    return (
      <NotFoundContainer>
        <h2>Product Not Found</h2>
        <p>The product you're looking for doesn't exist or has been removed.</p>
        <BackToProductsLink to="/products">Back to Products</BackToProductsLink>
      </NotFoundContainer>
    );
  }
  
  return (
    <ProductDetailContainer>
      <BreadcrumbNav>
        <Link to="/">Home</Link> / <Link to="/products">Products</Link> /{' '}
        <span>{product.name}</span>
      </BreadcrumbNav>
      
      <ProductMainContent>
        <ProductGallerySection>
          <ProductImageGallery
            images={productImages}
            activeIndex={activeImageIndex}
            onImageClick={setActiveImageIndex}
          />
        </ProductGallerySection>
        
        <ProductInfoSection>
          <ProductHeader>
            <ProductCategory>{product.category}</ProductCategory>
            <ProductTitle>{product.name}</ProductTitle>
            
            <ProductRatingContainer>
              <StarRating rating={product.rating} />
              <ProductReviews>
                {product.numReviews} {product.numReviews === 1 ? 'Review' : 'Reviews'}
              </ProductReviews>
            </ProductRatingContainer>
            
            <ProductPrice>${product.price.toFixed(2)}</ProductPrice>
          </ProductHeader>
          
          <ProductDescription>
            {product.description}
          </ProductDescription>
          
          <AvailabilityContainer>
            <AvailabilityLabel>Availability:</AvailabilityLabel>
            {product.inStock ? (
              <InStock>In Stock</InStock>
            ) : (
              <OutOfStock>Out of Stock</OutOfStock>
            )}
          </AvailabilityContainer>
          
          {product.inStock && (
            <AddToCartContainer>
              <QuantitySelector
                quantity={quantity}
                onChange={handleQuantityChange}
                max={10} // Set a reasonable max (in a real app, this would be the product's stock level)
              />
              
              <ActionButtons>
                <AddToCartButton onClick={handleAddToCart}>
                  Add to Cart
                </AddToCartButton>
                <BuyNowButton onClick={handleBuyNow}>
                  Buy Now
                </BuyNowButton>
              </ActionButtons>
            </AddToCartContainer>
          )}
          
          <ProductMeta>
            <MetaItem>
              <MetaLabel>SKU:</MetaLabel>
              <span>SKU-{product.id}</span>
            </MetaItem>
            <MetaItem>
              <MetaLabel>Category:</MetaLabel>
              <Link to={`/products?category=${product.category}`}>
                {product.category}
              </Link>
            </MetaItem>
            <MetaItem>
              <MetaLabel>Tags:</MetaLabel>
              <span>
                <Link to="/products?tag=featured">featured</Link>,{' '}
                <Link to={`/products?tag=${product.category.toLowerCase()}`}>
                  {product.category.toLowerCase()}
                </Link>
              </span>
            </MetaItem>
          </ProductMeta>
        </ProductInfoSection>
      </ProductMainContent>
      
      <ProductTabsSection>
        <ProductTabs 
          description={product.description}
          specifications={[
            { name: 'Brand', value: 'EcoShop' },
            { name: 'Material', value: 'Premium Quality' },
            { name: 'Dimensions', value: '10 × 20 × 5 cm' },
            { name: 'Weight', value: '0.5 kg' },
          ]}
          reviews={[
            {
              id: '1',
              userName: 'Jane Doe',
              rating: 5,
              date: '2023-05-10',
              comment: 'Excellent product, exceeded my expectations!'
            },
            {
              id: '2',
              userName: 'John Smith',
              rating: 4,
              date: '2023-04-28',
              comment: 'Good quality, fast shipping, but a bit pricey.'
            },
          ]}
          returnPolicy="30-day money-back guarantee. If you're not satisfied with your purchase, we'll accept a return and issue a refund."
        />
      </ProductTabsSection>
      
      <RelatedProductsSection>
        <SectionTitle>Related Products</SectionTitle>
        <RelatedProducts 
          currentProductId={product.id}
          category={product.category}
        />
      </RelatedProductsSection>
    </ProductDetailContainer>
  );
};

export default ProductDetailPage;

// Styled Components
const ProductDetailContainer = styled.div\`
  width: 100%;
\`;

const BreadcrumbNav = styled.div\`
  margin-bottom: 2rem;
  font-size: 0.9rem;
  color: var(--gray-dark);
  
  a {
    color: var(--gray-dark);
    text-decoration: none;
    
    &:hover {
      color: var(--primary-color);
    }
  }
  
  span {
    color: var(--text-color);
  }
\`;

const ProductMainContent = styled.div\`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
\`;

const ProductGallerySection = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1rem;
  
  @media (max-width: 992px) {
    margin-bottom: 1rem;
  }
\`;

const ProductInfoSection = styled.div\`
  display: flex;
  flex-direction: column;
\`;

const ProductHeader = styled.div\`
  margin-bottom: 1.5rem;
\`;

const ProductCategory = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
\`;

const ProductTitle = styled.h1\`
  font-size: 2rem;
  margin-bottom: 1rem;
\`;

const ProductRatingContainer = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
\`;

const ProductReviews = styled.span\`
  font-size: 0.9rem;
  color: var(--gray-dark);
  margin-left: 0.5rem;
\`;

const ProductPrice = styled.div\`
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--primary-color);
\`;

const ProductDescription = styled.div\`
  margin-bottom: 1.5rem;
  color: var(--gray-dark);
  line-height: 1.6;
\`;

const AvailabilityContainer = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
\`;

const AvailabilityLabel = styled.span\`
  font-weight: 500;
  margin-right: 0.5rem;
\`;

const InStock = styled.span\`
  color: var(--success-color);
  font-weight: 500;
\`;

const OutOfStock = styled.span\`
  color: var(--error-color);
  font-weight: 500;
\`;

const AddToCartContainer = styled.div\`
  margin-bottom: 2rem;
\`;

const ActionButtons = styled.div\`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  
  @media (max-width: 576px) {
    flex-direction: column;
  }
\`;

const CartButton = styled.button\`
  flex: 1;
  padding: 0.8rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  @media (max-width: 576px) {
    width: 100%;
  }
\`;

const AddToCartButton = styled(CartButton)\`
  background-color: var(--primary-color);
  color: white;
  border: none;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const BuyNowButton = styled(CartButton)\`
  background-color: white;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const ProductMeta = styled.div\`
  border-top: 1px solid var(--gray-light);
  padding-top: 1.5rem;
\`;

const MetaItem = styled.div\`
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  
  a {
    color: var(--primary-color);
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
\`;

const MetaLabel = styled.span\`
  font-weight: 500;
  margin-right: 0.5rem;
\`;

const ProductTabsSection = styled.section\`
  margin-bottom: 3rem;
\`;

const RelatedProductsSection = styled.section\`
  margin-bottom: 3rem;
\`;

const SectionTitle = styled.h2\`
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
\`;

const NotFoundContainer = styled.div\`
  text-align: center;
  padding: 3rem 1rem;
  
  h2 {
    margin-bottom: 1rem;
  }
  
  p {
    color: var(--gray-dark);
    margin-bottom: 2rem;
  }
\`;

const BackToProductsLink = styled(Link)\`
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

const LoadingText = styled.div\`
  text-align: center;
  padding: 3rem 1rem;
  font-size: 1.2rem;
  color: var(--gray-dark);
\`;

const ErrorText = styled.div\`
  text-align: center;
  padding: 3rem 1rem;
  color: var(--error-color);
\`;