import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/components/Footer.css';
import logoRemo from "../assets-copy/navbar/logoRemo.svg";
import phoneVector from "../assets-copy/footer/phoneVector.svg";
import emailVector from "../assets-copy/footer/emailVector.svg";
import { SUBCATEGORIES_BY_MAIN } from '../config/categories';

/* Footer category links from config: one per main (first sub) + a few extras for variety */
const FOOTER_CATEGORY_LINKS = [
  ...(SUBCATEGORIES_BY_MAIN.indian?.slice(0, 2) || []),
  ...(SUBCATEGORIES_BY_MAIN.american?.slice(0, 1) || []),
  ...(SUBCATEGORIES_BY_MAIN.chinese?.slice(0, 1) || []),
  ...(SUBCATEGORIES_BY_MAIN.turkish?.slice(0, 1) || []),
  ...(SUBCATEGORIES_BY_MAIN.indian?.slice(2, 4) || []),
].filter(Boolean).slice(0, 8);
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__main">
          <section className="footer__block footer__brand">
            <Link to="/" className="footer__logo-link">
              <img src={logoRemo} alt="Zippyyy" className="footer__logo-img" />
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
          </section>

          <section className="footer__block">
            <h4 className="footer__heading">Need Help</h4>
            <div className="footer__contact">
              <a href="tel:9342604322" className="footer__contact-row">
                <img src={phoneVector} alt="" aria-hidden />
                <span>(934) 260-4322</span>
              </a>
              <a href="mailto:contact@zippyyy.com" className="footer__contact-row">
                <img src={emailVector} alt="" aria-hidden />
                <span>contact@zippyyy.com</span>
              </a>
            </div>
          </section>

          <section className="footer__block">
            <h4 className="footer__heading">Delivery Areas</h4>
            <ul className="footer__list">
              <li>Manhattan, NYC</li>
              <li>Queens, NY</li>
              <li>Long Island, NY</li>
              <li>Nassau County</li>
              <li>Suffolk County</li>
              <li>+ More NY Areas</li>
            </ul>
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