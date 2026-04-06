import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import '../styles/components/Footer.css';
import logoRemo from "../assets-copy/navbar/logoRemo.svg";
import { SUBCATEGORIES_BY_MAIN } from '../config/categories';
import { useSiteBranding } from '../context/SiteBrandingContext';

/* Footer category links from config: one per main (first sub) + a few extras for variety */
const FOOTER_CATEGORY_LINKS = [
  ...(SUBCATEGORIES_BY_MAIN.indian?.slice(0, 2) || []),
  ...(SUBCATEGORIES_BY_MAIN.american?.slice(0, 1) || []),
  ...(SUBCATEGORIES_BY_MAIN.chinese?.slice(0, 1) || []),
  ...(SUBCATEGORIES_BY_MAIN.turkish?.slice(0, 1) || []),
  ...(SUBCATEGORIES_BY_MAIN.indian?.slice(2, 4) || []),
].filter(Boolean).slice(0, 8);
function Footer() {
  const { websiteName, websiteLogoSrc, siteSettings } = useSiteBranding();
  const socialLinks = siteSettings?.socialLinks || {};
  const visibleSocials = [
    {
      key: 'facebook',
      href: socialLinks.facebook,
      label: 'Facebook',
      icon: <svg className="footer__social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    },
    {
      key: 'instagram',
      href: socialLinks.instagram,
      label: 'Instagram',
      icon: <svg className="footer__social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
    },
    {
      key: 'linkedin',
      href: socialLinks.linkedin,
      label: 'LinkedIn',
      icon: <svg className="footer__social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    },
    {
      key: 'twitter',
      href: socialLinks.twitter,
      label: 'Twitter',
      icon: <svg className="footer__social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.244 2H21l-6.02 6.884L22 22h-5.48l-4.29-5.596L7.34 22H4.58l6.44-7.36L2 2h5.62l3.88 5.11L18.244 2zm-.96 18h1.52L6.8 3.9H5.2L17.284 20z"/></svg>,
    },
    {
      key: 'snapchat',
      href: socialLinks.snapchat,
      label: 'Snapchat',
      icon: <svg className="footer__social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.1c2.6 0 4.7 2.1 4.7 4.7v2.2c0 .6.3 1.3.8 1.6.4.3 1 .5 1.5.7.6.2 1 .7.8 1.3-.2.5-.8.8-1.4.8-.3 0-.6.3-.7.6-.5 1.5-1.7 2.6-3.3 3v1.2h1.2c.4 0 .8.3.9.7l.3 1.1c.1.5-.2 1-.7 1.1-.8.2-1.6.3-2.4.3s-1.6-.1-2.4-.3c-.5-.1-.8-.6-.7-1.1l.3-1.1c.1-.4.5-.7.9-.7h1.2V17c-1.6-.4-2.8-1.5-3.3-3-.1-.3-.4-.6-.7-.6-.6 0-1.2-.3-1.4-.8-.2-.6.2-1.1.8-1.3.5-.2 1.1-.4 1.5-.7.5-.3.8-1 .8-1.6V6.8c0-2.6 2.1-4.7 4.7-4.7z"/></svg>,
    },
    {
      key: 'whatsapp',
      href: socialLinks.whatsapp,
      label: 'WhatsApp',
      icon: <svg className="footer__social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.52 3.48A11.94 11.94 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.85 11.85 0 0 0 5.73 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42zm-8.46 18.3h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.22-3.75.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.52-5.23c0-5.47 4.46-9.92 9.94-9.92 2.65 0 5.14 1.03 7.01 2.9a9.86 9.86 0 0 1 2.91 7.01c0 5.48-4.46 9.93-9.93 9.93zm5.45-7.41c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.69-1.66-.94-2.27-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.11 3.23 5.12 4.53.72.31 1.28.5 1.72.64.72.23 1.37.2 1.89.12.58-.09 1.78-.73 2.03-1.44.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35z"/></svg>,
    },
  ].filter((item) => String(item.href || '').trim());
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__main">
          <section className="footer__block footer__brand">
            <Link to="/" className="footer__logo-link">
              <img
                src={websiteLogoSrc || logoRemo}
                alt={websiteName || 'Zippyyy'}
                className="footer__logo-img"
              />
            </Link>
            <p className="footer__about">
              At Zippyyy, customer satisfaction is important to us. This Refund & Cancellation Policy explains when refunds, replacements, or cancellations may be issued for orders placed on zippyyy.com.
            </p>
            <nav className="footer__policies" aria-label="Legal and policies">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/refund-policy">Refund Policy</Link>
              <Link to="/shipping-policy">Shipping Policy</Link>
              <Link to="/terms-and-conditions">Terms & Conditions</Link>
            </nav>
            {visibleSocials.length > 0 ? (
              <div className="footer__social" aria-label="Social media">
                {visibleSocials.map((social) => (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer__social-link"
                    aria-label={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <section className="footer__block">
            <h4 className="footer__heading">Need Help</h4>
            <div className="footer__contact">
              <a href="mailto:contact@zippyyy.com" className="footer__contact-row">
                <Mail className="footer__contact-icon" size={18} strokeWidth={2} aria-hidden />
                <span>contact@zippyyy.com</span>
              </a>
            </div>
          </section>

          <section className="footer__block">
            <h4 className="footer__heading">Delivery</h4>
            <p className="footer__delivery-text">
              We provide nationwide delivery across the United States, ensuring fast and reliable service to customers in all 50 states.
            </p>
          </section>

          <section className="footer__block">
            <h4 className="footer__heading">Categories</h4>
            <ul className="footer__list footer__links">
              {FOOTER_CATEGORY_LINKS.map((sub) => (
                <li key={sub.value}>
                  <Link to={`/products?category=${encodeURIComponent(sub.value)}`}>{sub.name}</Link>
                </li>
              ))}
            </ul>
            <h4 className="footer__heading footer__heading--mt">Links</h4>
            <ul className="footer__list footer__links">
              <li><Link to="/products">Browse Products</Link></li>
              <li><Link to="/contact">Contact Support</Link></li>
              <li><Link to="/register">Join Zippyyy Family</Link></li>
            </ul>
          </section>
        </div>
      </div>

      <div className="footer__bar">
        <div className="footer__container">
          <p className="footer__copy">&copy; 2026 Zippyyy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;