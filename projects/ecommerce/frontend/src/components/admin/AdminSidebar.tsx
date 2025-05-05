import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { RootState } from '../../store';
import { logout } from '../../store/slices/userSlice';

interface AdminSidebarProps {
  activePage: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state: RootState) => state.user);
  
  const [collapsed, setCollapsed] = useState(false);
  
  const handleToggleCollapse = () => {
    setCollapsed(!collapsed);
  };
  
  const handleLogout = () => {
    // @ts-ignore - logout is an async thunk
    dispatch(logout());
    navigate('/login');
  };
  
  return (
    <SidebarContainer collapsed={collapsed}>
      <SidebarHeader>
        <LogoContainer>
          {!collapsed && <Logo>EcoShop Admin</Logo>}
          <CollapseButton onClick={handleToggleCollapse}>
            {collapsed ? '►' : '◄'}
          </CollapseButton>
        </LogoContainer>
      </SidebarHeader>
      
      <UserInfo>
        <UserAvatar>
          {userInfo?.name.charAt(0).toUpperCase() || 'A'}
        </UserAvatar>
        {!collapsed && (
          <UserDetails>
            <UserName>{userInfo?.name || 'Admin User'}</UserName>
            <UserRole>{userInfo?.role || 'Admin'}</UserRole>
          </UserDetails>
        )}
      </UserInfo>
      
      <NavMenu>
        <NavItem active={activePage === 'dashboard'}>
          <NavLink to="/admin/dashboard">
            <NavIcon>📊</NavIcon>
            {!collapsed && <NavText>Dashboard</NavText>}
          </NavLink>
        </NavItem>
        
        <NavItem active={activePage === 'products'}>
          <NavLink to="/admin/products">
            <NavIcon>📦</NavIcon>
            {!collapsed && <NavText>Products</NavText>}
          </NavLink>
        </NavItem>
        
        <NavItem active={activePage === 'orders'}>
          <NavLink to="/admin/orders">
            <NavIcon>🛒</NavIcon>
            {!collapsed && <NavText>Orders</NavText>}
          </NavLink>
        </NavItem>
        
        <NavItem active={activePage === 'customers'}>
          <NavLink to="/admin/customers">
            <NavIcon>👥</NavIcon>
            {!collapsed && <NavText>Customers</NavText>}
          </NavLink>
        </NavItem>
        
        <NavItem active={activePage === 'categories'}>
          <NavLink to="/admin/categories">
            <NavIcon>🏷️</NavIcon>
            {!collapsed && <NavText>Categories</NavText>}
          </NavLink>
        </NavItem>
        
        <NavItem active={activePage === 'reviews'}>
          <NavLink to="/admin/reviews">
            <NavIcon>⭐</NavIcon>
            {!collapsed && <NavText>Reviews</NavText>}
          </NavLink>
        </NavItem>
        
        <SectionDivider />
        
        <NavItem active={activePage === 'settings'}>
          <NavLink to="/admin/settings">
            <NavIcon>⚙️</NavIcon>
            {!collapsed && <NavText>Settings</NavText>}
          </NavLink>
        </NavItem>
      </NavMenu>
      
      <SidebarFooter>
        <FooterItem>
          <FooterLink to="/">
            <FooterIcon>🏠</FooterIcon>
            {!collapsed && <FooterText>View Store</FooterText>}
          </FooterLink>
        </FooterItem>
        
        <FooterItem>
          <LogoutButton onClick={handleLogout}>
            <FooterIcon>🚪</FooterIcon>
            {!collapsed && <FooterText>Logout</FooterText>}
          </LogoutButton>
        </FooterItem>
      </SidebarFooter>
    </SidebarContainer>
  );
};

export default AdminSidebar;

// Styled Components
interface SidebarContainerProps {
  collapsed: boolean;
}

const SidebarContainer = styled.div<SidebarContainerProps>\`
  width: ${(props) => (props.collapsed ? '80px' : '250px')};
  height: 100vh;
  background-color: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: sticky;
  top: 0;
  
  @media (max-width: 768px) {
    width: ${(props) => (props.collapsed ? '0' : '250px')};
    position: fixed;
    z-index: 1000;
    box-shadow: ${(props) => 
      props.collapsed ? 'none' : '0 0 15px rgba(0, 0, 0, 0.2)'};
  }
\`;

const SidebarHeader = styled.div\`
  padding: 1.5rem;
  border-bottom: 1px solid #3c5060;
\`;

const LogoContainer = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
\`;

const Logo = styled.div\`
  font-size: 1.2rem;
  font-weight: bold;
\`;

const CollapseButton = styled.button\`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 0.8rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  
  &:hover {
    background-color: #3c5060;
  }
\`;

const UserInfo = styled.div\`
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #3c5060;
\`;

const UserAvatar = styled.div\`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #3a86ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.2rem;
  flex-shrink: 0;
\`;

const UserDetails = styled.div\`
  margin-left: 1rem;
  overflow: hidden;
\`;

const UserName = styled.div\`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
\`;

const UserRole = styled.div\`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
\`;

const NavMenu = styled.ul\`
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
\`;

interface NavItemProps {
  active: boolean;
}

const NavItem = styled.li<NavItemProps>\`
  a, button {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    color: ${(props) => (props.active ? 'white' : 'rgba(255, 255, 255, 0.7)')};
    background-color: ${(props) => (props.active ? '#3a86ff' : 'transparent')};
    transition: background-color 0.2s ease;
    text-decoration: none;
    
    &:hover {
      background-color: ${(props) => (props.active ? '#3a86ff' : '#3c5060')};
    }
  }
\`;

const NavLink = styled(Link)\`
  /* Styles already defined in NavItem */
\`;

const NavIcon = styled.div\`
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
\`;

const NavText = styled.div\`
  margin-left: 1rem;
\`;

const SectionDivider = styled.div\`
  height: 1px;
  background-color: #3c5060;
  margin: 0.5rem 0;
\`;

const SidebarFooter = styled.div\`
  border-top: 1px solid #3c5060;
\`;

const FooterItem = styled.div\`
  a, button {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    color: rgba(255, 255, 255, 0.7);
    transition: background-color 0.2s ease;
    text-decoration: none;
    
    &:hover {
      background-color: #3c5060;
    }
  }
\`;

const FooterLink = styled(Link)\`
  /* Styles already defined in FooterItem */
\`;

const LogoutButton = styled.button\`
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
\`;

const FooterIcon = styled.div\`
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
\`;

const FooterText = styled.div\`
  margin-left: 1rem;
\`;