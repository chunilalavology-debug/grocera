import React from "react";
import natchiyar1 from "../../../assets-copy/home/benertrue.png";

const GroceryBanner = () => {
  return (
    <section>
      <div className="w-full overflow-hidden">
        <div className="w-full h-[300px] md:h-[600px]  overflow-hidden relative ">

          {/* Image */}
          <img
           src={natchiyar1}          //  src="https://images.pexels.com/photos/3962294/pexels-photo-3962294.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Grocery Banner"
            className="w-full h-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/20 transition-colors duration-300" />
        </div>
      </div>
    </section>
  );
};

export default GroceryBanner;
