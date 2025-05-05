import React, { useState } from 'react';
import styled from 'styled-components';
import StarRating from '../common/StarRating';

interface Review {
  id: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
}

interface Specification {
  name: string;
  value: string;
}

interface ProductTabsProps {
  description: string;
  specifications: Specification[];
  reviews: Review[];
  returnPolicy: string;
}

const ProductTabs: React.FC<ProductTabsProps> = ({
  description,
  specifications,
  reviews,
  returnPolicy,
}) => {
  const [activeTab, setActiveTab] = useState('description');

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <TabsContainer>
      <TabsHeader>
        <TabButton
          active={activeTab === 'description'}
          onClick={() => handleTabClick('description')}
        >
          Description
        </TabButton>
        <TabButton
          active={activeTab === 'specifications'}
          onClick={() => handleTabClick('specifications')}
        >
          Specifications
        </TabButton>
        <TabButton
          active={activeTab === 'reviews'}
          onClick={() => handleTabClick('reviews')}
        >
          Reviews ({reviews.length})
        </TabButton>
        <TabButton
          active={activeTab === 'returns'}
          onClick={() => handleTabClick('returns')}
        >
          Returns & Warranty
        </TabButton>
      </TabsHeader>

      <TabContent>
        {activeTab === 'description' && (
          <DescriptionTab>
            <p>{description}</p>
          </DescriptionTab>
        )}

        {activeTab === 'specifications' && (
          <SpecificationsTab>
            <SpecificationsTable>
              <tbody>
                {specifications.map((spec, index) => (
                  <tr key={index}>
                    <SpecName>{spec.name}</SpecName>
                    <SpecValue>{spec.value}</SpecValue>
                  </tr>
                ))}
              </tbody>
            </SpecificationsTable>
          </SpecificationsTab>
        )}

        {activeTab === 'reviews' && (
          <ReviewsTab>
            {reviews.length === 0 ? (
              <NoReviews>
                This product doesn't have any reviews yet. Be the first to review this product!
              </NoReviews>
            ) : (
              <>
                <ReviewsList>
                  {reviews.map((review) => (
                    <ReviewItem key={review.id}>
                      <ReviewHeader>
                        <ReviewAuthor>{review.userName}</ReviewAuthor>
                        <ReviewDate>{review.date}</ReviewDate>
                      </ReviewHeader>
                      <StarRating rating={review.rating} />
                      <ReviewComment>{review.comment}</ReviewComment>
                    </ReviewItem>
                  ))}
                </ReviewsList>
                <WriteReviewButton>Write a Review</WriteReviewButton>
              </>
            )}
          </ReviewsTab>
        )}

        {activeTab === 'returns' && (
          <ReturnsTab>
            <h3>Return Policy</h3>
            <p>{returnPolicy}</p>
            <h3>Warranty Information</h3>
            <p>
              All products come with a standard 1-year manufacturer's warranty against
              defects in materials and workmanship under normal use.
            </p>
          </ReturnsTab>
        )}
      </TabContent>
    </TabsContainer>
  );
};

export default ProductTabs;

// Styled Components
const TabsContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
\`;

const TabsHeader = styled.div\`
  display: flex;
  border-bottom: 1px solid var(--gray-medium);
  
  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
\`;

interface TabButtonProps {
  active: boolean;
}

const TabButton = styled.button<TabButtonProps>\`
  padding: 1rem 1.5rem;
  background-color: ${(props) => (props.active ? 'white' : 'var(--gray-light)')};
  border: none;
  border-bottom: ${(props) => (props.active ? '2px solid var(--primary-color)' : '2px solid transparent')};
  color: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--text-color)')};
  font-weight: ${(props) => (props.active ? '500' : 'normal')};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: white;
  }
  
  @media (max-width: 768px) {
    flex: 1 1 auto;
    padding: 0.8rem 1rem;
    font-size: 0.9rem;
    text-align: center;
  }
\`;

const TabContent = styled.div\`
  padding: 2rem;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
  }
\`;

const DescriptionTab = styled.div\`
  line-height: 1.6;
\`;

const SpecificationsTab = styled.div\`
  // Styles for specifications tab
\`;

const SpecificationsTable = styled.table\`
  width: 100%;
  border-collapse: collapse;
  
  tr:nth-child(even) {
    background-color: var(--gray-light);
  }
\`;

const SpecName = styled.td\`
  padding: 0.8rem;
  font-weight: 500;
  width: 30%;
  border-bottom: 1px solid var(--gray-medium);
\`;

const SpecValue = styled.td\`
  padding: 0.8rem;
  border-bottom: 1px solid var(--gray-medium);
\`;

const ReviewsTab = styled.div\`
  // Styles for reviews tab
\`;

const NoReviews = styled.div\`
  text-align: center;
  color: var(--gray-dark);
  margin-bottom: 1.5rem;
\`;

const ReviewsList = styled.div\`
  margin-bottom: 2rem;
\`;

const ReviewItem = styled.div\`
  padding: 1rem 0;
  border-bottom: 1px solid var(--gray-light);
  
  &:last-child {
    border-bottom: none;
  }
\`;

const ReviewHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
\`;

const ReviewAuthor = styled.div\`
  font-weight: 500;
\`;

const ReviewDate = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const ReviewComment = styled.div\`
  margin-top: 0.5rem;
  line-height: 1.5;
\`;

const WriteReviewButton = styled.button\`
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const ReturnsTab = styled.div\`
  h3 {
    margin-bottom: 1rem;
    font-size: 1.2rem;
  }
  
  p {
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }
\`;