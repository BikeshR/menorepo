import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';

import { RootState } from '../../store';
import { toggleCart } from '../../store/slices/cartSlice';
import CartPopup from '../cart/CartPopup';
import SearchBar from '../common/SearchBar';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { totalItems, isCartOpen } = useSelector((state: RootState) => state.cart);
  const { items: products } = useSelector((state: RootState) => state.products);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleCartToggle = () => {
    dispatch(toggleCart());
  };

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSearch = (searchTerm: string) => {
    navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <HeaderContainer>
      <HeaderWrapper>
        <LogoContainer>
          <Link to="/">
            <Logo>EcoShop</Logo>
          </Link>
        </LogoContainer>

        <SearchContainer>
          <SearchBar onSearch={handleSearch} />
        </SearchContainer>

        <NavContainer>
          <NavList className={isMenuOpen ? 'active' : ''}>
            <NavItem>
              <NavLink to="/">Home</NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="/products">Products</NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="/about">About</NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="/contact">Contact</NavLink>
            </NavItem>
          </NavList>
        </NavContainer>

        <ActionsContainer>
          <CartButton onClick={handleCartToggle}>
            <CartIcon>🛒</CartIcon>
            {totalItems > 0 && <CartBadge>{totalItems}</CartBadge>}
          </CartButton>

          <UserButton>
            <UserIcon>👤</UserIcon>
          </UserButton>

          <MenuButton onClick={handleMenuToggle}>
            <MenuIcon>☰</MenuIcon>
          </MenuButton>
        </ActionsContainer>
      </HeaderWrapper>

      {isCartOpen && <CartPopup />}
    </HeaderContainer>
  );
};

export default Header;

// Styled Components
const HeaderContainer = styled.header\`
  background-color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
\`;

const HeaderWrapper = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 1rem;
  }
\`;

const LogoContainer = styled.div\`
  flex: 0 0 auto;
\`;

const Logo = styled.h1\`
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--primary-color);
  margin: 0;
\`;

const SearchContainer = styled.div\`
  flex: 1;
  max-width: 500px;
  margin: 0 2rem;

  @media (max-width: 768px) {
    display: none;
  }
\`;

const NavContainer = styled.nav\`
  flex: 0 1 auto;

  @media (max-width: 768px) {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-100%);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;

    &.active {
      transform: translateY(0);
      opacity: 1;
      visibility: visible;
    }
  }
\`;

const NavList = styled.ul\`
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;

  @media (max-width: 768px) {
    flex-direction: column;
    padding: 1rem 0;
  }

  &.active {
    display: flex;
  }
\`;

const NavItem = styled.li\`
  margin: 0 1rem;

  @media (max-width: 768px) {
    margin: 0;
  }
\`;

const NavLink = styled(Link)\`
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem;
  transition: color 0.2s ease;

  &:hover {
    color: var(--primary-color);
  }

  @media (max-width: 768px) {
    display: block;
    padding: 0.75rem 2rem;
    border-bottom: 1px solid var(--gray-light);
  }
\`;

const ActionsContainer = styled.div\`
  display: flex;
  align-items: center;
\`;

const CartButton = styled.button\`
  background: none;
  border: none;
  position: relative;
  cursor: pointer;
  margin-right: 1rem;
  padding: 0.5rem;
\`;

const CartIcon = styled.span\`
  font-size: 1.5rem;
\`;

const CartBadge = styled.span\`
  position: absolute;
  top: 0;
  right: 0;
  background-color: var(--secondary-color);
  color: white;
  font-size: 0.75rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
\`;

const UserButton = styled.button\`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;

  @media (max-width: 768px) {
    display: none;
  }
\`;

const UserIcon = styled.span\`
  font-size: 1.5rem;
\`;

const MenuButton = styled.button\`
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;

  @media (max-width: 768px) {
    display: block;
  }
\`;

const MenuIcon = styled.span\`
  font-size: 1.5rem;
\`;