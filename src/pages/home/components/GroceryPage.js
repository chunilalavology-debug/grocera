import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import breakfast1 from "../../../assets-copy/home/photobox1.png"
import breakfast2 from "../../../assets-copy/home/photobox2.png"
import breakfast3 from "../../../assets-copy/home/photobox3.png"
import breakfast4 from "../../../assets-copy/home/photobox4.png"

const categories = [
  {
    id: 1,
    title: "Breakfast & Cereals",
    img: breakfast1,
    // img: "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    id: 2,
    title: "Snacks & Sweets",
    img: breakfast2,
    // img: "https://images.pexels.com/photos/1191639/pexels-photo-1191639.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    id: 3,
    title: "Fresh Vegetables",
    img: breakfast3,
    // img: "https://images.pexels.com/photos/1391487/pexels-photo-1391487.jpeg?auto=compress&cs=tinysrgb&w=600",
  },
  {
    id: 4,
    title: " Green Juice Recipe",
    img: breakfast4,
    // img: "https://images.pexels.com/photos/616833/pexels-photo-616833.jpeg?auto=compress&cs=tinysrgb&w=600",
  }
];

const CategoryCard = ({ item }) => {
  return (
    <div className="bg-white rounded-2xl md:rounded-[30px] overflow-hidden shadow-sm hover:shadow-md transition">

      {/* Image */}
      <div className="p-2 sm:p-3">
        <div className="h-40 sm:h-56 md:h-80 w-full rounded-xl md:rounded-[25px] overflow-hidden bg-[#f5f5f5]">
          <img
            src={item.img}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-5 md:px-6 pb-5 sm:pb-7 md:pb-8 pt-2 text-center flex flex-col items-center">
        <h3 className="text-sm sm:text-lg md:text-xl font-extrabold text-slate-800">
          {item.title}
        </h3>

        <Link
          to={`/products?search=${encodeURIComponent(item.title)}`}
          className="mt-3 sm:mt-4 inline-flex items-center text-xs sm:text-sm font-bold text-green-600"
        >
          Explore Collection
          <ArrowRight className="ml-1 w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default function GroceryPage() {
  return (
    <div className="py-10 md:py-14 flex justify-center">
      <div className="container">

        {/* Heading */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="font-[800] text-2xl md:text-[35px] pb-2">
            Chinese Category
          </h2>
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-green-500 mb-2"></div>
          <p className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">
            Explore authentic flavors from Chinese
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((item) => (
            <div
              key={item.id}
              className={item.id === 4 ? "block lg:hidden" : ""}
            >
              <CategoryCard item={item} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
