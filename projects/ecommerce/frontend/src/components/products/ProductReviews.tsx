import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { RootState } from '../../store';
import StarRating from '../common/StarRating';
import ReviewForm from './ReviewForm';

interface Review {
  _id: string;
  name: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  isRecommended: boolean;
  helpfulVotes: number;
  createdAt: string;
  images?: string[];
}

interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingCounts: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recommendedPercentage: number;
}

interface ProductReviewsProps {
  productId: string;
}

const ProductReviews: React.FC<ProductReviewsProps> = ({ productId }) => {
  const { userInfo } = useSelector((state: RootState) => state.user);
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingStats, setRatingStats] = useState<RatingStats>({
    averageRating: 0,
    totalReviews: 0,
    ratingCounts: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    },
    recommendedPercentage: 0,
  });
  
  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState('-createdAt'); // Default to newest
  const [showReviewForm, setShowReviewForm] = useState(false);
  
  // Check if user has already reviewed
  const [hasReviewed, setHasReviewed] = useState(false);
  
  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true);
      
      try {
        // In a real app, we'd call the API
        // For demo purposes, we'll use mock data
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock reviews data
        const mockReviews: Review[] = [
          {
            _id: '1',
            name: 'John Doe',
            rating: 5,
            title: 'Excellent product, very satisfied!',
            comment: 'This product exceeded my expectations. The quality is outstanding and it works perfectly. I would definitely recommend it to anyone looking for a reliable solution.',
            isVerifiedPurchase: true,
            isRecommended: true,
            helpfulVotes: 12,
            createdAt: '2023-05-10T12:00:00Z',
          },
          {
            _id: '2',
            name: 'Jane Smith',
            rating: 4,
            title: 'Good product, but could be better',
            comment: 'Overall, I\'m satisfied with this purchase. It does what it\'s supposed to do, but there\'s room for improvement in terms of build quality. The price is fair for what you get.',
            isVerifiedPurchase: true,
            isRecommended: true,
            helpfulVotes: 5,
            createdAt: '2023-04-15T09:30:00Z',
          },
          {
            _id: '3',
            name: 'Michael Johnson',
            rating: 3,
            title: 'Average product',
            comment: 'The product is okay, but nothing special. It works as advertised but I expected more for the price. Delivery was quick though, so that\'s a plus.',
            isVerifiedPurchase: false,
            isRecommended: false,
            helpfulVotes: 2,
            createdAt: '2023-03-22T15:45:00Z',
            images: [
              'https://via.placeholder.com/150',
              'https://via.placeholder.com/150',
            ],
          },
        ];
        
        setReviews(mockReviews);
        setTotalPages(1);
        
        // Mock rating stats
        const mockStats: RatingStats = {
          averageRating: 4.2,
          totalReviews: 25,
          ratingCounts: {
            5: 15,
            4: 5,
            3: 3,
            2: 1,
            1: 1,
          },
          recommendedPercentage: 84,
        };
        
        setRatingStats(mockStats);
        
        // Check if current user has reviewed
        if (userInfo) {
          const userReview = mockReviews.find(
            (review) => review.name === userInfo.name
          );
          setHasReviewed(!!userReview);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch reviews');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReviews();
  }, [productId, currentPage, filterRating, sortOption, userInfo]);
  
  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Handle review helpful vote
  const handleHelpfulVote = (reviewId: string) => {
    // In a real app, we'd call the API to mark the review as helpful
    setReviews(
      reviews.map((review) =>
        review._id === reviewId
          ? { ...review, helpfulVotes: review.helpfulVotes + 1 }
          : review
      )
    );
  };
  
  // Handle filter by rating
  const handleFilterByRating = (rating: number | null) => {
    setFilterRating(rating);
    setCurrentPage(1);
  };
  
  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value);
    setCurrentPage(1);
  };
  
  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Handle review submission
  const handleReviewSubmit = (newReview: {
    rating: number;
    title: string;
    comment: string;
    isRecommended: boolean;
  }) => {
    // In a real app, we'd call the API to submit the review
    // For demo purposes, we'll just add it to the local state
    
    const createdReview: Review = {
      _id: Date.now().toString(),
      name: userInfo?.name || 'Anonymous',
      rating: newReview.rating,
      title: newReview.title,
      comment: newReview.comment,
      isVerifiedPurchase: true,
      isRecommended: newReview.isRecommended,
      helpfulVotes: 0,
      createdAt: new Date().toISOString(),
    };
    
    setReviews([createdReview, ...reviews]);
    setHasReviewed(true);
    setShowReviewForm(false);
    
    // Update rating stats
    const newTotal = ratingStats.totalReviews + 1;
    const newRatingCounts = { ...ratingStats.ratingCounts };
    // @ts-ignore - TypeScript doesn't know the exact keys
    newRatingCounts[newReview.rating] += 1;
    
    const totalRating = Object.entries(newRatingCounts).reduce(
      (sum, [rating, count]) => sum + Number(rating) * count,
      0
    );
    
    const newRecommendedCount = ratingStats.recommendedPercentage / 100 * ratingStats.totalReviews;
    const newRecommendedPercentage = ((newReview.isRecommended ? 1 : 0) + newRecommendedCount) / newTotal * 100;
    
    setRatingStats({
      averageRating: totalRating / newTotal,
      totalReviews: newTotal,
      ratingCounts: newRatingCounts,
      recommendedPercentage: newRecommendedPercentage,
    });
  };
  
  return (
    <ReviewsContainer>
      <ReviewsHeader>
        <ReviewsSummary>
          <RatingOverview>
            <AverageRating>{ratingStats.averageRating.toFixed(1)}</AverageRating>
            <StarRating 
              rating={ratingStats.averageRating} 
              size="large" 
            />
            <TotalReviews>{ratingStats.totalReviews} reviews</TotalReviews>
          </RatingOverview>
          
          <RatingDistribution>
            {[5, 4, 3, 2, 1].map((rating) => (
              <RatingBar key={rating} onClick={() => handleFilterByRating(rating)}>
                <RatingLabel>{rating} stars</RatingLabel>
                <RatingBarTrack>
                  <RatingBarFill 
                    width={ratingStats.totalReviews > 0 
                      ? (ratingStats.ratingCounts[rating as keyof typeof ratingStats.ratingCounts] / ratingStats.totalReviews) * 100 
                      : 0
                    } 
                  />
                </RatingBarTrack>
                <RatingCount>
                  {ratingStats.ratingCounts[rating as keyof typeof ratingStats.ratingCounts]}
                </RatingCount>
              </RatingBar>
            ))}
          </RatingDistribution>
          
          <RecommendationStat>
            <RecommendedPercentage>
              {Math.round(ratingStats.recommendedPercentage)}%
            </RecommendedPercentage>
            <RecommendedText>of reviewers recommend this product</RecommendedText>
          </RecommendationStat>
        </ReviewsSummary>
        
        <ReviewsActions>
          {!hasReviewed && userInfo ? (
            <WriteReviewButton onClick={() => setShowReviewForm(true)}>
              Write a Review
            </WriteReviewButton>
          ) : !userInfo ? (
            <LoginToReviewButton>
              Login to Write a Review
            </LoginToReviewButton>
          ) : null}
        </ReviewsActions>
      </ReviewsHeader>
      
      {showReviewForm && (
        <ReviewFormContainer>
          <ReviewForm 
            productId={productId} 
            onSubmit={handleReviewSubmit} 
            onCancel={() => setShowReviewForm(false)} 
          />
        </ReviewFormContainer>
      )}
      
      <ReviewsFilters>
        <FiltersLeft>
          <FilterButton 
            active={filterRating === null}
            onClick={() => handleFilterByRating(null)}
          >
            All Ratings
          </FilterButton>
          {[5, 4, 3, 2, 1].map((rating) => (
            <FilterButton 
              key={rating}
              active={filterRating === rating}
              onClick={() => handleFilterByRating(rating)}
            >
              {rating} Stars
            </FilterButton>
          ))}
        </FiltersLeft>
        
        <FiltersRight>
          <SortLabel>Sort by:</SortLabel>
          <SortSelect 
            value={sortOption}
            onChange={handleSortChange}
          >
            <option value="-createdAt">Newest</option>
            <option value="createdAt">Oldest</option>
            <option value="-rating">Highest Rating</option>
            <option value="rating">Lowest Rating</option>
            <option value="-helpfulVotes">Most Helpful</option>
          </SortSelect>
        </FiltersRight>
      </ReviewsFilters>
      
      {isLoading ? (
        <LoadingText>Loading reviews...</LoadingText>
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : reviews.length === 0 ? (
        <NoReviewsText>
          {filterRating 
            ? `No ${filterRating}-star reviews yet.` 
            : 'No reviews yet. Be the first to review this product!'
          }
        </NoReviewsText>
      ) : (
        <ReviewsList>
          {reviews.map((review) => (
            <ReviewItem key={review._id}>
              <ReviewHeader>
                <ReviewAuthor>{review.name}</ReviewAuthor>
                <ReviewDate>{formatDate(review.createdAt)}</ReviewDate>
              </ReviewHeader>
              
              <ReviewRating>
                <StarRating rating={review.rating} size="small" />
                <ReviewVerification>
                  {review.isVerifiedPurchase && (
                    <VerifiedBadge>Verified Purchase</VerifiedBadge>
                  )}
                </ReviewVerification>
              </ReviewRating>
              
              <ReviewTitle>{review.title}</ReviewTitle>
              <ReviewComment>{review.comment}</ReviewComment>
              
              {review.images && review.images.length > 0 && (
                <ReviewImages>
                  {review.images.map((image, index) => (
                    <ReviewImage key={index} src={image} alt={`Review image ${index + 1}`} />
                  ))}
                </ReviewImages>
              )}
              
              <ReviewRecommendation>
                {review.isRecommended 
                  ? '✓ I recommend this product' 
                  : '✗ I don\'t recommend this product'
                }
              </ReviewRecommendation>
              
              <ReviewFooter>
                <HelpfulButton onClick={() => handleHelpfulVote(review._id)}>
                  Was this review helpful?
                </HelpfulButton>
                <HelpfulVotes>
                  {review.helpfulVotes} {review.helpfulVotes === 1 ? 'person' : 'people'} found this helpful
                </HelpfulVotes>
              </ReviewFooter>
            </ReviewItem>
          ))}
        </ReviewsList>
      )}
      
      {totalPages > 1 && (
        <Pagination>
          <PaginationButton 
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </PaginationButton>
          
          <PageNumbers>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PageNumber 
                key={page}
                active={page === currentPage}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </PageNumber>
            ))}
          </PageNumbers>
          
          <PaginationButton 
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </PaginationButton>
        </Pagination>
      )}
    </ReviewsContainer>
  );
};

export default ProductReviews;

// Styled Components
const ReviewsContainer = styled.div\`
  width: 100%;
\`;

const ReviewsHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1.5rem;
  }
\`;

const ReviewsSummary = styled.div\`
  flex: 1;
\`;

const RatingOverview = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
\`;

const AverageRating = styled.div\`
  font-size: 2.5rem;
  font-weight: bold;
  margin-right: 0.5rem;
\`;

const TotalReviews = styled.div\`
  margin-left: 0.5rem;
  color: var(--gray-dark);
\`;

const RatingDistribution = styled.div\`
  margin-bottom: 1.5rem;
\`;

const RatingBar = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  cursor: pointer;
  
  &:hover {
    opacity: 0.8;
  }
\`;

const RatingLabel = styled.div\`
  width: 70px;
\`;

const RatingBarTrack = styled.div\`
  flex: 1;
  height: 8px;
  background-color: var(--gray-light);
  border-radius: 4px;
  overflow: hidden;
  margin: 0 0.5rem;
\`;

interface RatingBarFillProps {
  width: number;
}

const RatingBarFill = styled.div<RatingBarFillProps>\`
  height: 100%;
  width: ${(props) => props.width}%;
  background-color: var(--primary-color);
  border-radius: 4px;
\`;

const RatingCount = styled.div\`
  min-width: 30px;
  text-align: right;
\`;

const RecommendationStat = styled.div\`
  display: flex;
  align-items: baseline;
\`;

const RecommendedPercentage = styled.div\`
  font-size: 1.2rem;
  font-weight: bold;
  margin-right: 0.5rem;
\`;

const RecommendedText = styled.div\`
  color: var(--gray-dark);
\`;

const ReviewsActions = styled.div\`
  display: flex;
  align-items: flex-start;
\`;

const WriteReviewButton = styled.button\`
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    background-color: #3178cf;
  }
\`;

const LoginToReviewButton = styled.button\`
  padding: 0.8rem 1.5rem;
  background-color: var(--gray-light);
  color: var(--gray-dark);
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
\`;

const ReviewFormContainer = styled.div\`
  background-color: var(--gray-light);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  margin-bottom: 2rem;
\`;

const ReviewsFilters = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
\`;

const FiltersLeft = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
\`;

interface FilterButtonProps {
  active: boolean;
}

const FilterButton = styled.button<FilterButtonProps>\`
  padding: 0.5rem 1rem;
  border: 1px solid ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-medium)')};
  background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'white')};
  color: ${(props) => (props.active ? 'white' : 'var(--text-color)')};
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-light)')};
  }
\`;

const FiltersRight = styled.div\`
  display: flex;
  align-items: center;
\`;

const SortLabel = styled.label\`
  margin-right: 0.5rem;
\`;

const SortSelect = styled.select\`
  padding: 0.5rem;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
\`;

const LoadingText = styled.div\`
  text-align: center;
  padding: 2rem;
  color: var(--gray-dark);
\`;

const ErrorText = styled.div\`
  text-align: center;
  padding: 2rem;
  color: var(--error-color);
\`;

const NoReviewsText = styled.div\`
  text-align: center;
  padding: 2rem;
  color: var(--gray-dark);
\`;

const ReviewsList = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
\`;

const ReviewItem = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
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

const ReviewRating = styled.div\`
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
\`;

const ReviewVerification = styled.div\`
  margin-left: 1rem;
\`;

const VerifiedBadge = styled.span\`
  font-size: 0.8rem;
  background-color: rgba(76, 175, 80, 0.1);
  color: var(--success-color);
  padding: 0.25rem 0.5rem;
  border-radius: 20px;
\`;

const ReviewTitle = styled.h3\`
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
\`;

const ReviewComment = styled.div\`
  margin-bottom: 1rem;
  line-height: 1.5;
\`;

const ReviewImages = styled.div\`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
\`;

const ReviewImage = styled.img\`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
\`;

const ReviewRecommendation = styled.div\`
  font-size: 0.9rem;
  margin-bottom: 1rem;
\`;

const ReviewFooter = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  border-top: 1px solid var(--gray-light);
  padding-top: 1rem;
\`;

const HelpfulButton = styled.button\`
  background: none;
  border: 1px solid var(--gray-medium);
  padding: 0.4rem 0.8rem;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const HelpfulVotes = styled.div\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const Pagination = styled.div\`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
\`;

const PaginationButton = styled.button\`
  padding: 0.5rem 1rem;
  background-color: white;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  cursor: pointer;
  
  &:disabled {
    background-color: var(--gray-light);
    cursor: not-allowed;
    color: var(--gray-dark);
  }
  
  &:not(:disabled):hover {
    background-color: var(--gray-light);
  }
\`;

const PageNumbers = styled.div\`
  display: flex;
  margin: 0 0.5rem;
\`;

interface PageNumberProps {
  active: boolean;
}

const PageNumber = styled.button<PageNumberProps>\`
  width: 35px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-medium)')};
  background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'white')};
  color: ${(props) => (props.active ? 'white' : 'var(--text-color)')};
  border-radius: var(--border-radius);
  margin: 0 0.25rem;
  cursor: pointer;
  
  &:hover {
    background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-light)')};
  }
\`;