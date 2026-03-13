import React from "react";


export default function ShippingPolicy() {
return(
    <>
    
 <section className="policy-section">
      <div className="policy-container">
        <h1 className="policy-title">Shipping & Delivery Policy</h1>

        <p className="policy-date mb-2">
          <strong>Effective Date:</strong> {new Date().toLocaleDateString()}
        </p>

        <p className="policy-intro">
          At <strong>Zippyyy</strong>, we are committed to delivering your groceries
          quickly, safely, and securely. This Shipping & Delivery Policy explains
          how orders are fulfilled and delivered through zippyyy.com.
        </p>

        <div className="policy-block">
          <h2>1. Delivery Methods</h2>
          <p>Zippyyy delivers orders through:</p>
          <ul>
            <li>Our own delivery drivers</li>
            <li>Partnered third-party courier companies</li>
          </ul>
          <p>
            The delivery method used may vary depending on location, order size,
            availability, and operational requirements.
          </p>
        </div>

        <div className="policy-block">
          <h2>2. Delivery Timeframes</h2>
          <ul>
            <li>
              We aim to deliver orders on the same day, often within a few hours of
              order confirmation.
            </li>
            <li>
              Delivery times are estimates and may vary due to traffic, weather
              conditions, high demand, or unforeseen circumstances.
            </li>
          </ul>
        </div>

        <div className="policy-block">
          <h2>3. Delivery Areas</h2>
          <ul>
            <li>Deliveries are available only in supported service areas.</li>
            <li>
              Availability may change based on location and operational capacity.
            </li>
          </ul>
        </div>

        <div className="policy-block">
          <h2>4. Order Handling & Safety</h2>
          <ul>
            <li>
              All orders are handled with care to ensure items are delivered safely
              and securely.
            </li>
            <li>
              Perishable and temperature-sensitive items are packed appropriately
              to maintain quality during transit.
            </li>
          </ul>
        </div>

        <div className="policy-block">
          <h2>5. Delivery Responsibility</h2>
          <ul>
            <li>
              Customers are responsible for providing an accurate and complete
              delivery address.
            </li>
            <li>
              Zippyyy is not responsible for delays or failed deliveries caused by
              incorrect address details or unavailability of the recipient at the
              time of delivery.
            </li>
          </ul>
        </div>

        <div className="policy-block">
          <h2>6. Delivery Confirmation</h2>
          <ul>
            <li>
              Orders may be marked as delivered once handed to the customer, left
              at the delivery location, or confirmed by the delivery partner.
            </li>
            <li>
              Zippyyy is not liable for loss or damage after delivery confirmation
              if the order is unattended.
            </li>
          </ul>
        </div>

        <div className="policy-block">
          <h2>7. Delays & Exceptions</h2>
          <p>
            While we strive for timely delivery, Zippyyy is not responsible for
            delays caused by:
          </p>
          <ul>
            <li>Weather conditions</li>
            <li>Traffic or road closures</li>
            <li>Courier partner delays</li>
            <li>Events beyond our reasonable control</li>
          </ul>
        </div>

        <div className="policy-block">
          <h2>8. Policy Updates</h2>
          <p>
            Zippyyy reserves the right to update this Shipping & Delivery Policy at
            any time. Any changes will be posted on this page with an updated
            effective date.
          </p>
        </div>
      </div>
    </section>
    
    </>
)

}

