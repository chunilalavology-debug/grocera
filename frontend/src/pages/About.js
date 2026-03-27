import React from 'react';
import '../styles/pages/About.css';

export default function About() {
  return (
    <div className="about-page-wrapper">
      <div className="about-page-container">
        <div className="about-header">
          <h1 className="about-title">Why Choose Zippyyy?</h1>
          <p className="about-subtitle">Your trusted partner for fresh, global groceries delivered fast</p>
        </div>
        
        <div className="about-content-body">
          <div className="intro-section">
            <p>
              <strong className="highlight-text">Zippyyy</strong> is your one-stop shop for world-class groceries, delivering the freshest products from Indian, American, Chinese, Turkish, and global brands right to your doorstep. We pride ourselves on our <strong className="highlight-text">fast turnaround</strong>. Most orders are delivered within <strong>24-48 hours</strong> nationwide.
            </p>
          </div>

          <div className="features-section">
            <h2 className="section-heading">What Makes Us Special</h2>
            <ul className="feature-list">
              <li>
                <div className="feature-icon">⚡</div>
                <div className="feature-content">
                  <strong>Super-Fast Delivery</strong>
                  <span>Get your groceries in as little as 2 hours, guaranteed within 24 hours.</span>
                </div>
              </li>
              <li>
                <div className="feature-icon">🌱</div>
                <div className="feature-content">
                  <strong>Freshness First</strong>
                  <span>We source daily to ensure you receive only the freshest produce and products.</span>
                </div>
              </li>
              <li>
                <div className="feature-icon">🌎</div>
                <div className="feature-content">
                  <strong>Global Variety</strong>
                  <span>Shop authentic groceries from India, America, China, Turkey, and more—all in one place.</span>
                </div>
              </li>
              <li>
                <div className="feature-icon">🎉</div>
                <div className="feature-content">
                  <strong>Festival & Holiday Specials</strong>
                  <span>Unique selections for Diwali, Thanksgiving, Lunar New Year, Eid, and other global celebrations.</span>
                </div>
              </li>
              <li>
                <div className="feature-icon">🔒</div>
                <div className="feature-content">
                  <strong>Secure Payments</strong>
                  <span>Multiple digital payment options, including OTC & EBT cards.</span>
                </div>
              </li>
              <li>
                <div className="feature-icon">🧡</div>
                <div className="feature-content">
                  <strong>Trusted by Families</strong>
                  <span>Thousands of happy customers rely on Zippyyy for quality, speed, and service.</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="closing-section">
            <p className="closing-statement">
              Experience the difference with Zippyyy. Where convenience, freshness, and global flavors meet. 
            </p>
            <p className="cta-text">Why settle for less? Choose Zippyyy for your next grocery delivery!</p>
          </div>
        </div>
      </div>
    </div>
  );
}