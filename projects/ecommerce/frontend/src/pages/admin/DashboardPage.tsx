import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import styled from 'styled-components';

import { RootState } from '../../store';
import AdminSidebar from '../../components/admin/AdminSidebar';
import SalesChart from '../../components/admin/SalesChart';
import RevenueWidget from '../../components/admin/RevenueWidget';
import OrdersWidget from '../../components/admin/OrdersWidget';
import CustomersWidget from '../../components/admin/CustomersWidget';
import InventoryWidget from '../../components/admin/InventoryWidget';
import RecentOrdersTable from '../../components/admin/RecentOrdersTable';
import TopProductsTable from '../../components/admin/TopProductsTable';

// Mock data
import { mockOrders, mockProducts, mockSalesData, mockCustomers } from '../../mockData';

const DashboardPage: React.FC = () => {
  const { userInfo } = useSelector((state: RootState) => state.user);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  
  // Filter data based on date range
  const [filteredSalesData, setFilteredSalesData] = useState(mockSalesData);
  const [filteredOrders, setFilteredOrders] = useState(mockOrders);
  
  // Calculate dashboard metrics
  const totalRevenue = filteredSalesData.reduce((sum, day) => sum + day.revenue, 0);
  const totalOrders = filteredOrders.length;
  const totalCustomers = mockCustomers.length;
  const lowStockProducts = mockProducts.filter(product => product.countInStock < 10);
  
  // Update filtered data when date range changes
  useEffect(() => {
    // In a real app, we'd fetch data from the API based on the date range
    // For demo purposes, we'll just use mock data
    const today = new Date();
    
    let filteredOrders;
    let filteredSales;
    
    switch (dateRange) {
      case 'today':
        filteredOrders = mockOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate.setHours(0, 0, 0, 0) === today.setHours(0, 0, 0, 0);
        });
        filteredSales = mockSalesData.slice(-1);
        break;
      case 'week':
        filteredOrders = mockOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          const diffTime = Math.abs(today.getTime() - orderDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        });
        filteredSales = mockSalesData.slice(-7);
        break;
      case 'year':
        filteredOrders = mockOrders;
        filteredSales = mockSalesData;
        break;
      case 'month':
      default:
        filteredOrders = mockOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          const diffTime = Math.abs(today.getTime() - orderDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 30;
        });
        filteredSales = mockSalesData.slice(-30);
        break;
    }
    
    setFilteredOrders(filteredOrders);
    setFilteredSalesData(filteredSales);
  }, [dateRange]);
  
  // Redirect if not admin
  if (!userInfo || userInfo.role !== 'admin') {
    return <Navigate to="/login" />;
  }
  
  return (
    <PageContainer>
      <AdminSidebar activePage="dashboard" />
      
      <DashboardContent>
        <DashboardHeader>
          <DashboardTitle>Dashboard</DashboardTitle>
          
          <DateRangeSelector>
            <DateRangeButton
              active={dateRange === 'today'}
              onClick={() => setDateRange('today')}
            >
              Today
            </DateRangeButton>
            <DateRangeButton
              active={dateRange === 'week'}
              onClick={() => setDateRange('week')}
            >
              This Week
            </DateRangeButton>
            <DateRangeButton
              active={dateRange === 'month'}
              onClick={() => setDateRange('month')}
            >
              This Month
            </DateRangeButton>
            <DateRangeButton
              active={dateRange === 'year'}
              onClick={() => setDateRange('year')}
            >
              This Year
            </DateRangeButton>
          </DateRangeSelector>
        </DashboardHeader>
        
        <WidgetGrid>
          <RevenueWidget 
            revenue={totalRevenue} 
            percentageChange={12.5} 
            dateRange={dateRange} 
          />
          <OrdersWidget 
            orders={totalOrders} 
            percentageChange={8.3} 
            dateRange={dateRange} 
          />
          <CustomersWidget 
            customers={totalCustomers} 
            percentageChange={5.7} 
            dateRange={dateRange} 
          />
          <InventoryWidget 
            lowStockProducts={lowStockProducts.length} 
            totalProducts={mockProducts.length} 
          />
        </WidgetGrid>
        
        <ChartContainer>
          <ChartHeader>
            <ChartTitle>Sales Overview</ChartTitle>
            <ChartActions>
              <ExportButton>Export CSV</ExportButton>
            </ChartActions>
          </ChartHeader>
          <SalesChart salesData={filteredSalesData} dateRange={dateRange} />
        </ChartContainer>
        
        <TablesGrid>
          <TableContainer>
            <TableHeader>
              <TableTitle>Recent Orders</TableTitle>
              <ViewAllLink to="/admin/orders">View All</ViewAllLink>
            </TableHeader>
            <RecentOrdersTable orders={filteredOrders.slice(0, 5)} />
          </TableContainer>
          
          <TableContainer>
            <TableHeader>
              <TableTitle>Top Selling Products</TableTitle>
              <ViewAllLink to="/admin/products">View All</ViewAllLink>
            </TableHeader>
            <TopProductsTable products={mockProducts.slice(0, 5)} />
          </TableContainer>
        </TablesGrid>
      </DashboardContent>
    </PageContainer>
  );
};

export default DashboardPage;

// Styled Components
const PageContainer = styled.div\`
  display: flex;
  width: 100%;
  min-height: 100vh;
  background-color: #f8f9fa;
\`;

const DashboardContent = styled.div\`
  flex: 1;
  padding: 2rem;
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
\`;

const DashboardHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
\`;

const DashboardTitle = styled.h1\`
  margin: 0;
  font-size: 1.8rem;
\`;

const DateRangeSelector = styled.div\`
  display: flex;
  gap: 0.5rem;
  
  @media (max-width: 576px) {
    flex-wrap: wrap;
  }
\`;

interface DateRangeButtonProps {
  active: boolean;
}

const DateRangeButton = styled.button<DateRangeButtonProps>\`
  padding: 0.5rem 1rem;
  border: 1px solid ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-medium)')};
  background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'white')};
  color: ${(props) => (props.active ? 'white' : 'var(--text-color)')};
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    background-color: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--gray-light)')};
  }
\`;

const WidgetGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
\`;

const ChartContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
  margin-bottom: 2rem;
\`;

const ChartHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
\`;

const ChartTitle = styled.h2\`
  font-size: 1.2rem;
  margin: 0;
\`;

const ChartActions = styled.div\`
  // Styles for chart actions
\`;

const ExportButton = styled.button\`
  padding: 0.5rem 1rem;
  background-color: white;
  border: 1px solid var(--gray-medium);
  border-radius: var(--border-radius);
  font-size: 0.8rem;
  cursor: pointer;
  
  &:hover {
    background-color: var(--gray-light);
  }
\`;

const TablesGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
\`;

const TableContainer = styled.div\`
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
\`;

const TableHeader = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
\`;

const TableTitle = styled.h2\`
  font-size: 1.2rem;
  margin: 0;
\`;

const ViewAllLink = styled(Link)\`
  font-size: 0.9rem;
  color: var(--primary-color);
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
\`;