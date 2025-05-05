import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { Product } from '../../store/slices/productSlice';
import { addToCart } from '../../store/slices/cartSlice';
import StarRating from '../common/StarRating';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const dispatch = useDispatch();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      })
    );
  };

  return (
    <Card>
      <WishlistButton>❤</WishlistButton>
      
      <ProductLink to={`/products/${product.id}`}>
        <ImageContainer>
          <ProductImage src={product.image} alt={product.name} />
        </ImageContainer>

        <ProductInfo>
          <ProductCategory>{product.category}</ProductCategory>
          <ProductName>{product.name}</ProductName>
          
          <RatingContainer>
            <StarRating rating={product.rating} />
            <ReviewCount>({product.numReviews})</ReviewCount>
          </RatingContainer>
          
          <PriceContainer>
            <ProductPrice>${product.price.toFixed(2)}</ProductPrice>
            {product.inStock ? (
              <StockStatus inStock>In Stock</StockStatus>
            ) : (
              <StockStatus inStock={false}>Out of Stock</StockStatus>
            )}
          </PriceContainer>
        </ProductInfo>
      </ProductLink>
      
      <ButtonContainer>
        <AddToCartButton 
          onClick={handleAddToCart}
          disabled={!product.inStock}
        >
          Add to Cart
        </AddToCartButton>
      </ButtonContainer>
    </Card>
  );
};

export default ProductCard;

// Styled Components
const Card = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  position: relative;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-md);
  }
\`;

const WishlistButton = styled.button\`
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  z-index: 1;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 1;
  }
\`;

const ProductLink = styled(Link)\`
  text-decoration: none;
  color: inherit;
  display: block;
\`;

const ImageContainer = styled.div\`
  height: 200px;
  overflow: hidden;
  background-color: var(--gray-light);
  display: flex;
  align-items: center;
  justify-content: center;
\`;

const ProductImage = styled.img\`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  
  ${Card}:hover & {
    transform: scale(1.05);
  }
\`;

const ProductInfo = styled.div\`
  padding: 1rem;
\`;

const ProductCategory = styled.span\`
  color: var(--gray-dark);
  font-size: 0.8rem;
  display: block;
  margin-bottom: 0.3rem;
  text-transform: uppercase;
\`;

const ProductName = styled.h3\`
  font-size: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-color);
  
  /* Limit to 2 lines with ellipsis */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 2.4rem;
\`;

const RatingContainer = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
\`;

const ReviewCount = styled.span\`
  font-size: 0.8rem;
  color: var(--gray-dark);
  margin-left: 0.3rem;
\`;

const PriceContainer = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
\`;

const ProductPrice = styled.span\`
  font-weight: bold;
  font-size: 1.1rem;
  color: var(--text-color);
\`;

interface StockStatusProps {
  inStock: boolean;
}

const StockStatus = styled.span<StockStatusProps>\`
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  background-color: ${(props) =>
    props.inStock ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'};
  color: ${(props) =>
    props.inStock ? 'var(--success-color)' : 'var(--error-color)'};
\`;

const ButtonContainer = styled.div\`
  padding: 0 1rem 1rem;
\`;

const AddToCartButton = styled.button\`
  width: 100%;
  padding: 0.7rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: #3178cf;
  }
  
  &:disabled {
    background-color: var(--gray-medium);
    cursor: not-allowed;
  }
\`;