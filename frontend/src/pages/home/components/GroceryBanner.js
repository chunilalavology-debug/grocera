import React from "react";
import deal1 from "../../../assets-copy/home/beners.png";

const GroceryBanner = () => {
  return (
    <section>
      <div className="w-full overflow-hidden">
        <div className="w-full h-[300px] md:h-[600px]  overflow-hidden relative group">

          {/* Image */}
          <img
            src={deal1}
            // src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200"
            alt="Grocery Banner"
            className="w-full h-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
        </div>
      </div>
    </section>
  );
};

export default GroceryBanner;
