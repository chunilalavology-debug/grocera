import React from "react";
import { Link } from "react-router-dom";


export default function PrivacyPolicy() {
  return (
    <>

      <section className="policy-section">
        <div className="policy-container">
          <h1 className="policy-title">Privacy Policy</h1>

          <p className="policy-date mb-2">
            <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
          </p>



          <p className="policy-intro">
            <strong>Zippyyy</strong> (“we,” “our,” “us”) values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit or make a purchase from <Link to="/" className="text-[#667eea]">https://zippyyy.com/.</Link>
          </p>


          <div className="policy-block">
            <h2>1. Information We Collect</h2>
            <p>We may collect the following information:</p>

            <div>
              <h2 className="Personal_text">a. Personal Information</h2>
              <ul>
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Billing and shipping address</li>
                <li>Payment information (processed securely by third-party providers)</li>
              </ul>
            </div>

            <div>
              <h2 className="Personal_text">b. Non-Personal Information</h2>
              <ul>
                <li>IP address</li>
                <li>Browser type</li>
              </ul>
            </div>
          </div>

          <div className="policy-block">
            <h2>2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul>
              <li>
                Process and deliver orders
              </li>
              <li>
                Communicate order updates and customer support
              </li>
              <li>Improve website performance and user experience
              </li>
              <li>Prevent fraud and ensure platform security
              </li>
              <li>Comply with legal obligations
              </li>
            </ul>
          </div>

          <div className="policy-block">
            <h2>3. Sharing of Information</h2>
            <p>We <strong>do not sell or rent </strong> your personal information. We may share information with:</p>
            <ul>
              <li>
                Payment processors
              </li>
              <li>Delivery and logistics partners</li>
              <li>Legal or regulatory authorities when required</li>
            </ul>
          </div>

          <div className="policy-block">
            <h2>4. Cookies & Tracking Technologies</h2>
            <p>We use cookies and similar technologies to enhance user experience, analyze traffic, and personalize content. You may disable cookies through your browser settings.</p>

          </div>

          <div className="policy-block">
            <h2>5. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data. However, no online transmission is 100% secure.</p>
      
          </div>

          <div className="policy-block">
            <h2>6. Your Rights</h2>
            <p>You may request access, correction, or deletion of your personal information by contacting us.</p>
          </div>

          <div className="policy-block">
            <h2>7. Changes to This Policy</h2>
            <p>
            We may update this Privacy Policy at any time. Changes will be posted on this page with an updated date.
            </p>
            <p>📧 <strong>Contact:</strong> <Link to="mailto:rbsgrocery@gmail.com">contact@zippyyy.com</Link></p>
          
          </div>
        </div>
      </section>

    </>
  )

}

