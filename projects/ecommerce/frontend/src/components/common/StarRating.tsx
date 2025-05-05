import React from 'react';
import styled from 'styled-components';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'small' | 'medium' | 'large';
  clickable?: boolean;
  onRatingChange?: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'medium',
  clickable = false,
  onRatingChange,
}) => {
  const renderStars = () => {
    const stars = [];
    
    for (let i = 1; i <= maxRating; i++) {
      const starValue = i;
      const filled = i <= Math.floor(rating);
      const halfFilled = !filled && i === Math.ceil(rating) && rating % 1 !== 0;
      
      stars.push(
        <Star
          key={i}
          filled={filled}
          halfFilled={halfFilled}
          size={size}
          clickable={clickable}
          onClick={() => {
            if (clickable && onRatingChange) {
              onRatingChange(starValue);
            }
          }}
        >
          {filled ? '★' : halfFilled ? '⯨' : '☆'}
        </Star>
      );
    }
    
    return stars;
  };
  
  return <StarRatingContainer>{renderStars()}</StarRatingContainer>;
};

export default StarRating;

// Styled Components
const StarRatingContainer = styled.div\`
  display: flex;
  align-items: center;
\`;

interface StarProps {
  filled: boolean;
  halfFilled: boolean;
  size: 'small' | 'medium' | 'large';
  clickable: boolean;
}

const Star = styled.span<StarProps>\`
  color: ${(props) => (props.filled || props.halfFilled ? '#FFC107' : '#D1D1D1')};
  font-size: ${(props) => {
    switch (props.size) {
      case 'small':
        return '1rem';
      case 'large':
        return '1.5rem';
      case 'medium':
      default:
        return '1.2rem';
    }
  }};
  cursor: ${(props) => (props.clickable ? 'pointer' : 'default')};
  margin-right: 2px;
\`;