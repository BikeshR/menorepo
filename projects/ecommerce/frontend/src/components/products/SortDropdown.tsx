import React, { useState } from 'react';
import styled from 'styled-components';

interface SortDropdownProps {
  onSortChange: (sortOption: 'price-asc' | 'price-desc' | 'rating') => void;
}

type SortOption = {
  id: 'price-asc' | 'price-desc' | 'rating';
  label: string;
};

const sortOptions: SortOption[] = [
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'rating', label: 'Highest Rated' },
];

const SortDropdown: React.FC<SortDropdownProps> = ({ onSortChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SortOption>(sortOptions[0]);
  
  const handleSelect = (option: SortOption) => {
    setSelectedOption(option);
    onSortChange(option.id);
    setIsOpen(false);
  };
  
  return (
    <DropdownContainer>
      <DropdownButton onClick={() => setIsOpen(!isOpen)}>
        {selectedOption.label}
        <DropdownIcon>{isOpen ? '▲' : '▼'}</DropdownIcon>
      </DropdownButton>
      
      {isOpen && (
        <DropdownMenu>
          {sortOptions.map((option) => (
            <DropdownItem
              key={option.id}
              active={option.id === selectedOption.id}
              onClick={() => handleSelect(option)}
            >
              {option.label}
              {option.id === selectedOption.id && <CheckIcon>✓</CheckIcon>}
            </DropdownItem>
          ))}
        </DropdownMenu>
      )}
    </DropdownContainer>
  );
};

export default SortDropdown;

// Styled Components
const DropdownContainer = styled.div\`
  position: relative;
  min-width: 180px;
  
  @media (max-width: 576px) {
    width: 100%;
  }
\`;

const DropdownButton = styled.button\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.6rem 1rem;
  background-color: white;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const DropdownIcon = styled.span\`
  font-size: 0.6rem;
  margin-left: 0.5rem;
\`;

const DropdownMenu = styled.div\`
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  z-index: 10;
  background-color: white;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  overflow: hidden;
\`;

interface DropdownItemProps {
  active: boolean;
}

const DropdownItem = styled.div<DropdownItemProps>\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 1rem;
  cursor: pointer;
  background-color: ${(props) => (props.active ? 'var(--gray-light)' : 'white')};
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const CheckIcon = styled.span\`
  color: var(--primary-color);
  font-weight: bold;
\`;