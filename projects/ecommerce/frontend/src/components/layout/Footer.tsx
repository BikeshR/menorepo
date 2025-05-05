import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <FooterContainer>
      <FooterContent>
        <FooterSection>
          <SectionTitle>EcoShop</SectionTitle>
          <p>Your one-stop shop for quality products.</p>
          <SocialLinks>
            <SocialLink href="https://facebook.com" target="_blank" rel="noopener noreferrer">
              Facebook
            </SocialLink>
            <SocialLink href="https://twitter.com" target="_blank" rel="noopener noreferrer">
              Twitter
            </SocialLink>
            <SocialLink href="https://instagram.com" target="_blank" rel="noopener noreferrer">
              Instagram
            </SocialLink>
          </SocialLinks>
        </FooterSection>

        <FooterSection>
          <SectionTitle>Shop</SectionTitle>
          <FooterLinks>
            <FooterLink to="/products">All Products</FooterLink>
            <FooterLink to="/products?category=electronics">Electronics</FooterLink>
            <FooterLink to="/products?category=clothing">Clothing</FooterLink>
            <FooterLink to="/products?category=home">Home & Kitchen</FooterLink>
          </FooterLinks>
        </FooterSection>

        <FooterSection>
          <SectionTitle>Customer Service</SectionTitle>
          <FooterLinks>
            <FooterLink to="/contact">Contact Us</FooterLink>
            <FooterLink to="/faq">FAQs</FooterLink>
            <FooterLink to="/shipping">Shipping & Returns</FooterLink>
            <FooterLink to="/warranty">Warranty</FooterLink>
          </FooterLinks>
        </FooterSection>

        <FooterSection>
          <SectionTitle>About</SectionTitle>
          <FooterLinks>
            <FooterLink to="/about">Our Story</FooterLink>
            <FooterLink to="/blog">Blog</FooterLink>
            <FooterLink to="/careers">Careers</FooterLink>
            <FooterLink to="/privacy">Privacy Policy</FooterLink>
            <FooterLink to="/terms">Terms of Service</FooterLink>
          </FooterLinks>
        </FooterSection>
      </FooterContent>

      <FooterBottom>
        <Copyright>© {currentYear} EcoShop. All rights reserved.</Copyright>
        <PaymentMethods>
          <PaymentIcon>💳</PaymentIcon>
          <PaymentIcon>💳</PaymentIcon>
          <PaymentIcon>💳</PaymentIcon>
          <PaymentIcon>💳</PaymentIcon>
        </PaymentMethods>
      </FooterBottom>
    </FooterContainer>
  );
};

export default Footer;

// Styled Components
const FooterContainer = styled.footer\`
  background-color: #f8f9fa;
  padding: 3rem 0 1rem;
  margin-top: 3rem;
  color: var(--text-color);
\`;

const FooterContent = styled.div\`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    padding: 0 1rem;
  }
\`;

const FooterSection = styled.div\`
  margin-bottom: 1.5rem;
\`;

const SectionTitle = styled.h3\`
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: var(--primary-color);
\`;

const FooterLinks = styled.div\`
  display: flex;
  flex-direction: column;
\`;

const FooterLink = styled(Link)\`
  color: var(--text-color);
  text-decoration: none;
  margin-bottom: 0.5rem;
  transition: color 0.2s ease;

  &:hover {
    color: var(--primary-color);
  }
\`;

const SocialLinks = styled.div\`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
\`;

const SocialLink = styled.a\`
  color: var(--primary-color);
  text-decoration: none;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
\`;

const FooterBottom = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 2rem auto 0;
  padding: 1.5rem 2rem 0;
  border-top: 1px solid var(--gray-medium);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem 1rem 0;
  }
\`;

const Copyright = styled.p\`
  font-size: 0.9rem;
  color: var(--gray-dark);
\`;

const PaymentMethods = styled.div\`
  display: flex;
  gap: 0.5rem;
\`;

const PaymentIcon = styled.span\`
  font-size: 1.5rem;
\`;