import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../store';
import { fetchProducts } from '../store/slices/productSlice';
import ProductCard from '../components/products/ProductCard';
import Hero from '../components/home/Hero';
import FeaturedCategories from '../components/home/FeaturedCategories';
import Testimonials from '../components/home/Testimonials';
import Newsletter from '../components/common/Newsletter';

const HomePage: React.FC = () => {
  const dispatch = useDispatch();
  const { items: products, isLoading, error } = useSelector(
    (state: RootState) => state.products
  );

  useEffect(() => {
    // @ts-ignore (fetchProducts is an async thunk)
    dispatch(fetchProducts());
  }, [dispatch]);

  // Get featured products (top rated)
  const featuredProducts = [...products]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <HomePage>
      <Hero />

      <FeaturedCategories />

      <SectionContainer>
        <SectionTitle>Featured Products</SectionTitle>
        
        {isLoading ? (
          <LoadingText>Loading products...</LoadingText>
        ) : error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <>
            <ProductGrid>
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductGrid>
            
            <ViewAllLink to="/products">View All Products</ViewAllLink>
          </>
        )}
      </SectionContainer>

      <Testimonials />
      <Newsletter />
    </HomePage>
  );
};

export default HomePage;

// Styled Components
const HomePage = styled.div\`
  width: 100%;
\`;

const SectionContainer = styled.section\`
  margin: 4rem 0;
  text-align: center;
\`;

const SectionTitle = styled.h2\`
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
  color: var(--text-color);
  
  &:after {
    content: '';
    display: block;
    width: 50px;
    height: 3px;
    background-color: var(--primary-color);
    margin: 0.5rem auto 0;
  }
\`;

const ProductGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
\`;

const ViewAllLink = styled(Link)\`
  display: inline-block;
  margin-top: 3rem;
  padding: 0.8rem 2rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
\`;

const LoadingText = styled.p\`
  font-size: 1.2rem;
  color: var(--gray-dark);
\`;

const ErrorText = styled.p\`
  color: var(--error-color);
  font-size: 1.2rem;
\`;