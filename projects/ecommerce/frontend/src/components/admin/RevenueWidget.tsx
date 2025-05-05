import React from 'react';
import styled from 'styled-components';

interface RevenueWidgetProps {
  revenue: number;
  percentageChange: number;
  dateRange: 'today' | 'week' | 'month' | 'year';
}

const RevenueWidget: React.FC<RevenueWidgetProps> = ({
  revenue,
  percentageChange,
  dateRange,
}) => {
  const formatRevenue = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  };
  
  const getComparisonPeriod = (): string => {
    switch (dateRange) {
      case 'today':
        return 'Yesterday';
      case 'week':
        return 'Last Week';
      case 'year':
        return 'Last Year';
      case 'month':
      default:
        return 'Last Month';
    }
  };
  
  return (
    <WidgetContainer>
      <WidgetTitle>Revenue</WidgetTitle>
      
      <RevenueAmount>{formatRevenue(revenue)}</RevenueAmount>
      
      <PercentageChange positive={percentageChange >= 0}>
        <ChangeIcon>{percentageChange >= 0 ? '↑' : '↓'}</ChangeIcon>
        <ChangeText>
          {Math.abs(percentageChange)}% from {getComparisonPeriod().toLowerCase()}
        </ChangeText>
      </PercentageChange>
      
      <WidgetChart>
        <ChartBar height={80} />
        <ChartBar height={60} />
        <ChartBar height={90} />
        <ChartBar height={70} />
        <ChartBar height={100} highlight />
      </WidgetChart>
    </WidgetContainer>
  );
};

export default RevenueWidget;

// Styled Components
const WidgetContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  height: 100%;
\`;

const WidgetTitle = styled.h3\`
  font-size: 1rem;
  color: var(--gray-dark);
  margin: 0 0 1rem 0;
\`;

const RevenueAmount = styled.div\`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
\`;

interface PercentageChangeProps {
  positive: boolean;
}

const PercentageChange = styled.div<PercentageChangeProps>\`
  display: flex;
  align-items: center;
  color: ${(props) => (props.positive ? 'var(--success-color)' : 'var(--error-color)')};
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
\`;

const ChangeIcon = styled.span\`
  margin-right: 0.25rem;
\`;

const ChangeText = styled.span\`
  // Styles for change text
\`;

const WidgetChart = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 100px;
  padding-top: 1rem;
\`;

interface ChartBarProps {
  height: number;
  highlight?: boolean;
}

const ChartBar = styled.div<ChartBarProps>\`
  width: 18%;
  height: ${(props) => props.height}%;
  background-color: ${(props) => 
    props.highlight ? 'var(--primary-color)' : 'rgba(58, 134, 255, 0.3)'};
  border-radius: 3px;
\`;