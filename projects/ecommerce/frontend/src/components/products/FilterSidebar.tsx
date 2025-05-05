import React, { useState } from 'react';
import styled from 'styled-components';
import PriceRangeSlider from './PriceRangeSlider';

interface FilterSidebarProps {
  priceRange: [number, number];
  selectedCategories: string[];
  selectedRating: number | null;
  availableCategories: string[];
  onPriceRangeChange: (range: [number, number]) => void;
  onCategoryChange: (categories: string[]) => void;
  onRatingChange: (rating: number | null) => void;
  onClearAll: () => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  priceRange,
  selectedCategories,
  selectedRating,
  availableCategories,
  onPriceRangeChange,
  onCategoryChange,
  onRatingChange,
  onClearAll,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    categories: true,
    rating: true,
  });
  
  const toggleSection = (section: 'price' | 'categories' | 'rating') => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };
  
  const handleCategoryChange = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoryChange([...selectedCategories, category]);
    }
  };
  
  const handleRatingClick = (rating: number) => {
    if (selectedRating === rating) {
      onRatingChange(null);
    } else {
      onRatingChange(rating);
    }
  };
  
  const isFilterApplied = () => {
    return (
      selectedCategories.length > 0 ||
      selectedRating !== null ||
      priceRange[0] > 0 ||
      priceRange[1] < 1000
    );
  };
  
  return (
    <FilterContainer>
      <FilterHeader>
        <FilterTitle>Filters</FilterTitle>
        {isFilterApplied() && (
          <ClearAllButton onClick={onClearAll}>Clear All</ClearAllButton>
        )}
      </FilterHeader>
      
      <FilterSection>
        <SectionHeader onClick={() => toggleSection('price')}>
          <SectionTitle>Price Range</SectionTitle>
          <ExpandIcon>{expandedSections.price ? '−' : '+'}</ExpandIcon>
        </SectionHeader>
        
        {expandedSections.price && (
          <SectionContent>
            <PriceRangeSlider
              min={0}
              max={1000}
              value={priceRange}
              onChange={onPriceRangeChange}
            />
            <PriceInputs>
              <PriceInput
                type="number"
                value={priceRange[0]}
                onChange={(e) => {
                  const min = Number(e.target.value);
                  onPriceRangeChange([min, priceRange[1]]);
                }}
                min={0}
                max={priceRange[1]}
              />
              <PriceRangeSeparator>to</PriceRangeSeparator>
              <PriceInput
                type="number"
                value={priceRange[1]}
                onChange={(e) => {
                  const max = Number(e.target.value);
                  onPriceRangeChange([priceRange[0], max]);
                }}
                min={priceRange[0]}
                max={1000}
              />
            </PriceInputs>
          </SectionContent>
        )}
      </FilterSection>
      
      <FilterSection>
        <SectionHeader onClick={() => toggleSection('categories')}>
          <SectionTitle>Categories</SectionTitle>
          <ExpandIcon>{expandedSections.categories ? '−' : '+'}</ExpandIcon>
        </SectionHeader>
        
        {expandedSections.categories && (
          <SectionContent>
            <CategoryList>
              {availableCategories.map((category) => (
                <CategoryItem key={category}>
                  <CategoryCheckbox
                    type="checkbox"
                    id={`category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                  />
                  <CategoryLabel htmlFor={`category-${category}`}>
                    {category}
                  </CategoryLabel>
                </CategoryItem>
              ))}
            </CategoryList>
          </SectionContent>
        )}
      </FilterSection>
      
      <FilterSection>
        <SectionHeader onClick={() => toggleSection('rating')}>
          <SectionTitle>Rating</SectionTitle>
          <ExpandIcon>{expandedSections.rating ? '−' : '+'}</ExpandIcon>
        </SectionHeader>
        
        {expandedSections.rating && (
          <SectionContent>
            <RatingList>
              {[5, 4, 3, 2, 1].map((rating) => (
                <RatingItem key={rating}>
                  <RatingButton
                    active={selectedRating === rating}
                    onClick={() => handleRatingClick(rating)}
                  >
                    {Array(rating)
                      .fill(0)
                      .map((_, i) => (
                        <RatingStar key={i}>★</RatingStar>
                      ))}
                    {Array(5 - rating)
                      .fill(0)
                      .map((_, i) => (
                        <RatingEmptyStar key={i}>☆</RatingEmptyStar>
                      ))}
                    <span>&nbsp;& Up</span>
                  </RatingButton>
                </RatingItem>
              ))}
            </RatingList>
          </SectionContent>
        )}
      </FilterSection>
    </FilterContainer>
  );
};

export default FilterSidebar;

// Styled Components
const FilterContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
\`;

const FilterHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
\`;

const FilterTitle = styled.h2\`
  font-size: 1.2rem;
  margin: 0;
\`;

const ClearAllButton = styled.button\`
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  
  &:hover {
    text-decoration: underline;
  }
\`;

const FilterSection = styled.div\`
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--gray-light);
  padding-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
    border-bottom: none;
    padding-bottom: 0;
  }
\`;

const SectionHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  cursor: pointer;
\`;

const SectionTitle = styled.h3\`
  font-size: 1rem;
  margin: 0;
\`;

const ExpandIcon = styled.span\`
  font-size: 1.2rem;
  color: var(--gray-dark);
\`;

const SectionContent = styled.div\`
  // Styles for section content
\`;

const PriceInputs = styled.div\`
  display: flex;
  align-items: center;
  margin-top: 1rem;
\`;

const PriceInput = styled.input\`
  width: 80px;
  padding: 0.5rem;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  text-align: center;
\`;

const PriceRangeSeparator = styled.span\`
  margin: 0 0.5rem;
  color: var(--gray-dark);
\`;

const CategoryList = styled.ul\`
  list-style: none;
  padding: 0;
  margin: 0;
\`;

const CategoryItem = styled.li\`
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
\`;

const CategoryCheckbox = styled.input\`
  margin-right: 0.5rem;
\`;

const CategoryLabel = styled.label\`
  cursor: pointer;
\`;

const RatingList = styled.ul\`
  list-style: none;
  padding: 0;
  margin: 0;
\`;

const RatingItem = styled.li\`
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
\`;

interface RatingButtonProps {
  active: boolean;
}

const RatingButton = styled.button<RatingButtonProps>\`
  background: ${(props) => (props.active ? 'var(--gray-light)' : 'none')};
  border: none;
  padding: 0.5rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const RatingStar = styled.span\`
  color: #ffc107;
\`;

const RatingEmptyStar = styled.span\`
  color: #d1d1d1;
\`;