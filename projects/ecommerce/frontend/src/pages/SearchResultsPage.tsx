import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';

import { RootState } from '../store';
import { fetchProducts, searchProducts, sortProducts } from '../store/slices/productSlice';
import ProductCard from '../components/products/ProductCard';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import FilterSidebar from '../components/products/FilterSidebar';
import SortDropdown from '../components/products/SortDropdown';
import Breadcrumb from '../components/common/Breadcrumb';

const SearchResultsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { items: products, filteredItems, isLoading, error } = useSelector(
    (state: RootState) => state.products
  );
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Parse search query from URL
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('search') || '';
  const categoryParam = searchParams.get('category') || '';
  
  // Initialize state for filters
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    categoryParam ? [categoryParam] : []
  );
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  
  // Load products on initial render
  useEffect(() => {
    // @ts-ignore (fetchProducts is an async thunk)
    dispatch(fetchProducts());
  }, [dispatch]);
  
  // Apply search when URL changes
  useEffect(() => {
    if (searchQuery) {
      dispatch(searchProducts(searchQuery));
    }
  }, [dispatch, searchQuery]);
  
  // Filter products based on selected filters
  useEffect(() => {
    // Filtering happens in the product slice for now
    // In a real app, we'd have a more sophisticated filtering mechanism
  }, [selectedCategories, priceRange, selectedRating]);
  
  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Scroll to top when changing pages
    window.scrollTo(0, 0);
  };
  
  const handleSortChange = (sortOption: 'price-asc' | 'price-desc' | 'rating') => {
    dispatch(sortProducts(sortOption));
  };
  
  const handleSearchSubmit = (searchTerm: string) => {
    navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
    dispatch(searchProducts(searchTerm));
  };
  
  const handleFilterChange = {
    priceRange: (range: [number, number]) => {
      setPriceRange(range);
    },
    categories: (categories: string[]) => {
      setSelectedCategories(categories);
      
      // Update URL with selected category if there's only one
      if (categories.length === 1) {
        navigate({
          pathname: location.pathname,
          search: `?${searchQuery ? `search=${searchQuery}&` : ''}category=${categories[0]}`,
        });
      } else if (searchQuery && categories.length === 0) {
        navigate({
          pathname: location.pathname,
          search: `?search=${searchQuery}`,
        });
      }
    },
    rating: (rating: number | null) => {
      setSelectedRating(rating);
    },
    clearAll: () => {
      setPriceRange([0, 1000]);
      setSelectedCategories([]);
      setSelectedRating(null);
      
      // Reset URL to just search query if present
      if (searchQuery) {
        navigate({
          pathname: location.pathname,
          search: `?search=${searchQuery}`,
        });
      } else {
        navigate(location.pathname);
      }
    },
  };
  
  const toggleMobileFilters = () => {
    setMobileFiltersOpen(!mobileFiltersOpen);
  };
  
  const resultTitle = searchQuery
    ? `Search results for "${searchQuery}"`
    : categoryParam
    ? `${categoryParam} Products`
    : 'All Products';
  
  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: 'Home', path: '/' },
          { label: 'Products', path: '/products' },
          ...(searchQuery ? [{ label: `Search: ${searchQuery}`, path: '' }] : []),
          ...(categoryParam ? [{ label: categoryParam, path: '' }] : []),
        ]}
      />
      
      <HeaderSection>
        <PageTitle>{resultTitle}</PageTitle>
        <SearchContainer>
          <SearchBar 
            onSearch={handleSearchSubmit} 
            placeholder="Refine your search..." 
            size="large"
          />
        </SearchContainer>
      </HeaderSection>
      
      <ResultsContainer>
        <FilterToggle onClick={toggleMobileFilters}>
          {mobileFiltersOpen ? 'Hide Filters' : 'Show Filters'} 
          <FilterIcon>{mobileFiltersOpen ? '✕' : '☰'}</FilterIcon>
        </FilterToggle>
        
        <aside className={`filters ${mobileFiltersOpen ? 'open' : ''}`}>
          <FilterSidebar
            priceRange={priceRange}
            selectedCategories={selectedCategories}
            selectedRating={selectedRating}
            onPriceRangeChange={handleFilterChange.priceRange}
            onCategoryChange={handleFilterChange.categories}
            onRatingChange={handleFilterChange.rating}
            onClearAll={handleFilterChange.clearAll}
            availableCategories={Array.from(new Set(products.map(p => p.category)))}
          />
        </aside>
        
        <main>
          <ResultsHeader>
            <ResultsCount>
              {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'} found
            </ResultsCount>
            
            <SortContainer>
              <SortLabel>Sort by:</SortLabel>
              <SortDropdown onSortChange={handleSortChange} />
            </SortContainer>
          </ResultsHeader>
          
          {isLoading ? (
            <LoadingMessage>Loading products...</LoadingMessage>
          ) : error ? (
            <ErrorMessage>{error}</ErrorMessage>
          ) : filteredItems.length === 0 ? (
            <NoResultsMessage>
              <h3>No products found</h3>
              <p>Try adjusting your search or filter criteria</p>
              <ClearFiltersButton onClick={handleFilterChange.clearAll}>
                Clear All Filters
              </ClearFiltersButton>
            </NoResultsMessage>
          ) : (
            <>
              <ProductGrid>
                {currentItems.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ProductGrid>
              
              {totalPages > 1 && (
                <PaginationContainer>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </PaginationContainer>
              )}
            </>
          )}
        </main>
      </ResultsContainer>
    </PageContainer>
  );
};

export default SearchResultsPage;

// Styled Components
const PageContainer = styled.div\`
  width: 100%;
\`;

const HeaderSection = styled.div\`
  margin-bottom: 2rem;
\`;

const PageTitle = styled.h1\`
  margin-bottom: 1.5rem;
\`;

const SearchContainer = styled.div\`
  max-width: 800px;
  margin: 0 auto;
\`;

const ResultsContainer = styled.div\`
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  position: relative;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
    
    aside.filters {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 300px;
      background-color: white;
      z-index: 100;
      box-shadow: var(--shadow-lg);
      overflow-y: auto;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      padding: 1rem;
      
      &.open {
        transform: translateX(0);
      }
    }
  }
\`;

const FilterToggle = styled.button\`
  display: none;
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: var(--border-radius);
  margin-bottom: 1rem;
  cursor: pointer;
  font-weight: 500;
  align-items: center;
  justify-content: space-between;
  
  @media (max-width: 992px) {
    display: flex;
  }
\`;

const FilterIcon = styled.span\`
  font-size: 1.2rem;
\`;

const ResultsHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  @media (max-width: 576px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
\`;

const ResultsCount = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const SortContainer = styled.div\`
  display: flex;
  align-items: center;
\`;

const SortLabel = styled.label\`
  margin-right: 0.5rem;
  font-size: 0.9rem;
\`;

const ProductGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  
  @media (max-width: 576px) {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }
\`;

const PaginationContainer = styled.div\`
  margin-top: 2rem;
  display: flex;
  justify-content: center;
\`;

const LoadingMessage = styled.div\`
  text-align: center;
  padding: 3rem;
  color: var(--gray-dark);
\`;

const ErrorMessage = styled.div\`
  text-align: center;
  padding: 2rem;
  color: var(--error-color);
  background-color: rgba(244, 67, 54, 0.1);
  border-radius: var(--border-radius);
\`;

const NoResultsMessage = styled.div\`
  text-align: center;
  padding: 3rem;
  
  h3 {
    margin-bottom: 0.5rem;
  }
  
  p {
    color: var(--gray-dark);
    margin-bottom: 1.5rem;
  }
\`;

const ClearFiltersButton = styled.button\`
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 500;
\`;