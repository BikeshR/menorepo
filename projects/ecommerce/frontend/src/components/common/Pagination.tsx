import React from 'react';
import styled from 'styled-components';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
}) => {
  // If there's only one page, don't render pagination
  if (totalPages <= 1) return null;
  
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    
    // Calculate range of pages to show
    const totalPageNumbers = siblingCount * 2 + 3; // siblings on both sides + current page + first + last
    
    // If we can show all pages
    if (totalPageNumbers >= totalPages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
      return pageNumbers;
    }
    
    // Calculate left and right siblings
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
    
    // Do not show dots if there's just one page number between the extremes
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;
    
    // First page is always shown
    pageNumbers.push(1);
    
    // Add left dots if needed
    if (shouldShowLeftDots) {
      pageNumbers.push('...');
    } else if (leftSiblingIndex > 1) {
      // Otherwise, add page 2 if we're not starting there
      pageNumbers.push(2);
    }
    
    // Add the siblings and current page
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      if (i !== 1 && i !== totalPages) {
        pageNumbers.push(i);
      }
    }
    
    // Add right dots if needed
    if (shouldShowRightDots) {
      pageNumbers.push('...');
    } else if (rightSiblingIndex < totalPages - 1) {
      // Otherwise, add second to last page if we're not ending there
      pageNumbers.push(totalPages - 1);
    }
    
    // Last page is always shown
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };
  
  const pageNumbers = getPageNumbers();
  
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };
  
  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };
  
  return (
    <PaginationContainer>
      <PaginationButton
        onClick={handlePrevious}
        disabled={currentPage === 1}
      >
        Previous
      </PaginationButton>
      
      <PageNumbersContainer>
        {pageNumbers.map((pageNumber, index) => {
          if (pageNumber === '...') {
            return <Dots key={`dots-${index}`}>...</Dots>;
          }
          
          return (
            <PageNumber
              key={pageNumber}
              active={pageNumber === currentPage}
              onClick={() => onPageChange(Number(pageNumber))}
            >
              {pageNumber}
            </PageNumber>
          );
        })}
      </PageNumbersContainer>
      
      <PaginationButton
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        Next
      </PaginationButton>
    </PaginationContainer>
  );
};

export default Pagination;

// Styled Components
const PaginationContainer = styled.div\`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
\`;

const PaginationButton = styled.button\`
  padding: 0.5rem 1rem;
  background-color: ${(props) => (props.disabled ? 'var(--gray-light)' : 'white')};
  color: ${(props) => (props.disabled ? 'var(--gray-dark)' : 'var(--text-color)')};
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  font-size: 0.9rem;
  
  &:hover:not(:disabled) {
    background-color: var(--gray-light);
  }
  
  @media (max-width: 576px) {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }
\`;

const PageNumbersContainer = styled.div\`
  display: flex;
  align-items: center;
\`;

interface PageNumberProps {
  active: boolean;
}

const PageNumber = styled.button<PageNumberProps>\`
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
  margin: 0 0.25rem;
  background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'white')};
  color: ${(props) => (props.active ? 'white' : 'var(--text-color)')};
  border: 1px solid ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-medium)')};
  font-weight: ${(props) => (props.active ? 'bold' : 'normal')};
  cursor: ${(props) => (props.active ? 'default' : 'pointer')};
  
  &:hover:not([active]) {
    background-color: var(--gray-light);
  }
  
  @media (max-width: 576px) {
    width: 2rem;
    height: 2rem;
    font-size: 0.9rem;
    margin: 0 0.1rem;
  }
\`;

const Dots = styled.span\`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--gray-dark);
  
  @media (max-width: 576px) {
    width: 1.5rem;
  }
\`;