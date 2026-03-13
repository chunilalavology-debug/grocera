import React from "react";
import { Link } from "react-router-dom";


export default function TermsConditions() {
  return (
    <>
      <section className="policy-section">
        <div className="policy-container">
          <h1 className="policy-title">Terms & Conditions</h1>

          <p className="policy-date mb-2">
            <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
          </p>



          <p className="policy-intro">
            By accessing or using  <Link to="/" className="text-[#667eea]">https://zippyyy.com/.</Link> you agree to the following Terms & Conditions
          </p>


          <div className="policy-block">
            <h2>1. Use of Website</h2>
            <div>
              <ul>
                <li>You must be at least <strong>18 years old</strong> to place an order</li>
                <li>You agree to use the website for lawful purposes only</li>
              </ul>
            </div>


          </div>

          <div className="policy-block">
            <h2>2. Product Information</h2>
            <ul>
              <li>
                Product descriptions, images, and prices are provided to the best of our accuracy
              </li>
              <li>
                Availability and pricing may change without notice
              </li>

            </ul>
          </div>

          <div className="policy-block">
            <h2>3. Orders & Payments</h2>
            <ul>
              <li>
                All payments must be completed at checkout
              </li>
              <li>We reserve the right to cancel or refuse any order
              </li>
            </ul>
          </div>

          <div className="policy-block">
            <h2>4. Food Safety Disclaimer</h2>
            <p>While we ensure proper handling and inspection, customers must:
            </p>

            <ul>
              <li>
                Store food products appropriately upon delivery
              </li>
              <li>
                Follow usage and storage instructions provided

              </li>
            </ul>

          </div>

          <div className="policy-block">
            <h2>5. Limitation of Liability</h2>
            <p>Zippyyy shall not be liable for:
            </p>
            <ul>
              <li>
                Indirect or consequential damages

              </li>
              <li>
                Issues caused by improper storage or use after delivery
              </li>
            </ul>
          </div>

          <div className="policy-block">
            <h2>6. Intellectual Property</h2>
            <p>All website content, logos, text, and graphics are the exclusive property of Zippyyy and may not be used without permission.</p>
          </div>

          <div className="policy-block">
            <h2>7. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the <strong>United States and the State of Delaware</strong>, without regard to conflict of law principles.</p>
            <p>📧 <strong>Contact:</strong> <Link to="mailto:rbsgrocery@gmail.com">contact@zippyyy.com</Link></p>
          </div>
          <div className="policy-block">
            <h2>8. Modifications</h2>
            <p>
              We reserve the right to update these Terms at any time. Continued use of the site constitutes acceptance of changes.
            </p>
            <p>📧 <strong>Contact:</strong> <Link to="mailto:rbsgrocery@gmail.com">contact@zippyyy.com</Link></p>
          </div>
        </div>
      </section>

    </>
  )

}

