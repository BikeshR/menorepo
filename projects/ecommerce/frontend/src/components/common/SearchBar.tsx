import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RootState } from '../../store';
import { searchProducts } from '../../store/slices/productSlice';
import { productsApi } from '../../services/api';

interface SearchBarProps {
  onSearch?: (searchTerm: string) => void;
  placeholder?: string;
  size?: 'small' | 'medium' | 'large';
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search products...',
  size = 'medium',
  autoFocus = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const { categories } = useSelector((state: RootState) => state.products);
  
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  
  // Parse search query from URL on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('search') || '';
    if (query) {
      setSearchTerm(query);
    }
  }, [location.search]);
  
  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Fetch search suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      
      setIsLoadingSuggestions(true);
      
      try {
        // In a real app, you'd call an API to get suggestions
        // Here we'll simulate with a timeout and filter through categories and popular terms
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Combine categories with popular search terms
        const popularTerms = ['shoes', 'phone', 'laptop', 'watch', 'headphones'];
        const allTerms = [...categories, ...popularTerms];
        
        const filteredSuggestions = allTerms
          .filter(term => 
            term.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .slice(0, 5); // Limit to 5 suggestions
          
        setSuggestions(filteredSuggestions);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchSuggestions, 300);
    
    return () => {
      clearTimeout(debounceTimer);
    };
  }, [searchTerm, categories]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchTerm.trim()) {
      // Dispatch search action
      dispatch(searchProducts(searchTerm));
      
      // Call onSearch callback if provided
      if (onSearch) {
        onSearch(searchTerm);
      }
      
      // Navigate to search results page
      navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
      
      // Close suggestions
      setIsFocused(false);
    }
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    
    // Submit search with the selected suggestion
    dispatch(searchProducts(suggestion));
    
    if (onSearch) {
      onSearch(suggestion);
    }
    
    navigate(`/products?search=${encodeURIComponent(suggestion)}`);
    setIsFocused(false);
  };
  
  const handleClear = () => {
    setSearchTerm('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  return (
    <SearchContainer size={size}>
      <SearchForm onSubmit={handleSubmit}>
        <SearchInput
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoFocus={autoFocus}
          size={size}
        />
        
        {searchTerm && (
          <ClearButton type="button" onClick={handleClear}>
            ✕
          </ClearButton>
        )}
        
        <SearchButton type="submit" size={size}>
          <SearchIcon>🔍</SearchIcon>
        </SearchButton>
      </SearchForm>
      
      {isFocused && (searchTerm.length >= 2 || suggestions.length > 0) && (
        <SuggestionsContainer ref={suggestionRef}>
          {isLoadingSuggestions ? (
            <LoadingMessage>Loading suggestions...</LoadingMessage>
          ) : suggestions.length > 0 ? (
            <SuggestionsList>
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <SuggestionIcon>🔍</SuggestionIcon>
                  <span>{suggestion}</span>
                </SuggestionItem>
              ))}
            </SuggestionsList>
          ) : searchTerm.length >= 2 ? (
            <NoSuggestionsMessage>No suggestions found</NoSuggestionsMessage>
          ) : null}
        </SuggestionsContainer>
      )}
    </SearchContainer>
  );
};

export default SearchBar;

// Styled Components
const SearchContainer = styled.div<{ size: string }>\`
  position: relative;
  width: 100%;
  max-width: ${(props) => {
    switch (props.size) {
      case 'small':
        return '250px';
      case 'large':
        return '600px';
      case 'medium':
      default:
        return '400px';
    }
  }};
\`;

const SearchForm = styled.form\`
  display: flex;
  align-items: center;
  position: relative;
\`;

const SearchInput = styled.input<{ size: string }>\`
  width: 100%;
  padding: ${(props) => {
    switch (props.size) {
      case 'small':
        return '0.5rem 2.5rem 0.5rem 0.75rem';
      case 'large':
        return '0.9rem 3.5rem 0.9rem 1rem';
      case 'medium':
      default:
        return '0.7rem 3rem 0.7rem 1rem';
    }
  }};
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  font-size: ${(props) => (props.size === 'large' ? '1.1rem' : '1rem')};
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(58, 134, 255, 0.2);
  }
\`;

const SearchButton = styled.button<{ size: string }>\`
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.75rem;
  cursor: pointer;
  
  width: ${(props) => {
    switch (props.size) {
      case 'small':
        return '2.5rem';
      case 'large':
        return '3.5rem';
      case 'medium':
      default:
        return '3rem';
    }
  }};
\`;

const SearchIcon = styled.span\`
  font-size: 1.2rem;
  color: var(--gray-dark);
\`;

const ClearButton = styled.button\`
  position: absolute;
  right: 2.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--gray-dark);
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const SuggestionsContainer = styled.div\`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
  box-shadow: var(--shadow-md);
  z-index: 10;
  margin-top: 0.5rem;
  overflow: hidden;
\`;

const SuggestionsList = styled.ul\`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
\`;

const SuggestionItem = styled.li\`
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const SuggestionIcon = styled.span\`
  color: var(--gray-dark);
  margin-right: 0.5rem;
  font-size: 0.9rem;
\`;

const LoadingMessage = styled.div\`
  padding: 0.75rem 1rem;
  color: var(--gray-dark);
  text-align: center;
  font-size: 0.9rem;
\`;

const NoSuggestionsMessage = styled.div\`
  padding: 0.75rem 1rem;
  color: var(--gray-dark);
  text-align: center;
  font-size: 0.9rem;
\`;