import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface SalesChartProps {
  salesData: SalesDataPoint[];
  dateRange: 'today' | 'week' | 'month' | 'year';
}

const SalesChart: React.FC<SalesChartProps> = ({ salesData, dateRange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || !salesData || salesData.length === 0) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Find max revenue and orders for scaling
    const maxRevenue = Math.max(...salesData.map(d => d.revenue));
    const maxOrders = Math.max(...salesData.map(d => d.orders));
    
    // Define colors
    const revenueColor = '#3a86ff';
    const ordersColor = '#ff006e';
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    
    // Y-axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();
    
    // Draw revenue line
    ctx.beginPath();
    ctx.strokeStyle = revenueColor;
    ctx.lineWidth = 2;
    
    salesData.forEach((dataPoint, index) => {
      const x = padding + (index / (salesData.length - 1)) * chartWidth;
      const y = height - padding - (dataPoint.revenue / maxRevenue) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw revenue area
    ctx.beginPath();
    ctx.fillStyle = `${revenueColor}20`; // 20% opacity
    
    salesData.forEach((dataPoint, index) => {
      const x = padding + (index / (salesData.length - 1)) * chartWidth;
      const y = height - padding - (dataPoint.revenue / maxRevenue) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    // Complete the area by drawing to the bottom
    ctx.lineTo(padding + chartWidth, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fill();
    
    // Draw orders line
    ctx.beginPath();
    ctx.strokeStyle = ordersColor;
    ctx.lineWidth = 2;
    
    salesData.forEach((dataPoint, index) => {
      const x = padding + (index / (salesData.length - 1)) * chartWidth;
      const y = height - padding - (dataPoint.orders / maxOrders) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    const gridLinesCount = 5;
    for (let i = 1; i < gridLinesCount; i++) {
      const y = padding + (i / gridLinesCount) * chartHeight;
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
    }
    
    // Vertical grid lines
    const xLabelsCount = Math.min(salesData.length, dateRange === 'year' ? 12 : 7);
    for (let i = 1; i < xLabelsCount; i++) {
      const x = padding + (i / xLabelsCount) * chartWidth;
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
    }
    
    ctx.stroke();
    
    // Draw X-axis labels
    ctx.fillStyle = '#757575';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    let xLabels: string[] = [];
    
    switch (dateRange) {
      case 'today':
        xLabels = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'];
        break;
      case 'week':
        xLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        break;
      case 'month':
        xLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        break;
      case 'year':
        xLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        break;
    }
    
    xLabels.forEach((label, index) => {
      const x = padding + (index / (xLabels.length - 1)) * chartWidth;
      ctx.fillText(label, x, height - padding + 10);
    });
    
    // Draw Y-axis labels (revenue)
    ctx.fillStyle = revenueColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= gridLinesCount; i++) {
      const y = height - padding - (i / gridLinesCount) * chartHeight;
      const value = (i / gridLinesCount) * maxRevenue;
      ctx.fillText(`$${value.toFixed(0)}`, padding - 10, y);
    }
    
    // Draw Y-axis labels (orders)
    ctx.fillStyle = ordersColor;
    ctx.textAlign = 'left';
    
    for (let i = 0; i <= gridLinesCount; i++) {
      const y = height - padding - (i / gridLinesCount) * chartHeight;
      const value = (i / gridLinesCount) * maxOrders;
      ctx.fillText(`${value.toFixed(0)}`, width - padding + 10, y);
    }
    
    // Draw legend
    const legendX = padding;
    const legendY = padding - 20;
    
    // Revenue legend
    ctx.beginPath();
    ctx.strokeStyle = revenueColor;
    ctx.lineWidth = 2;
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    
    ctx.fillStyle = revenueColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Revenue', legendX + 30, legendY);
    
    // Orders legend
    ctx.beginPath();
    ctx.strokeStyle = ordersColor;
    ctx.lineWidth = 2;
    ctx.moveTo(legendX + 100, legendY);
    ctx.lineTo(legendX + 120, legendY);
    ctx.stroke();
    
    ctx.fillStyle = ordersColor;
    ctx.fillText('Orders', legendX + 130, legendY);
  }, [salesData, dateRange]);
  
  return (
    <ChartContainer>
      <Canvas ref={canvasRef} width="800" height="400" />
    </ChartContainer>
  );
};

export default SalesChart;

// Styled Components
const ChartContainer = styled.div\`
  width: 100%;
  height: 400px;
  overflow: hidden;
\`;

const Canvas = styled.canvas\`
  width: 100% !important;
  height: 100% !important;
\`;