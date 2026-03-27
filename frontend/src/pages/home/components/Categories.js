import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Unsplash1 from "../../../assets-copy/home/photo3.png"
import Unsplash2 from "../../../assets-copy/home/photo2.png"
import Unsplash3 from "../../../assets-copy/home/photo1.png"
import Unsplash4 from "../../../assets-copy/home/photo-4.png"

const categories = [
  {
    id: 1,
    title: "Breakfast & Cereals",
    tag: "FRESHO!",
    img: Unsplash1,
    // img: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&q=80&w=500",
  },
  {
    id: 2,
    title: "Snacks",
    tag: "FRESHO!",
    img: Unsplash2,
    // img: "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=500",
  },
  {
    id: 3,
    title: "Sauces & Canned",
    tag: "FRESHO!",
    img: Unsplash3,
    // img: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=500",
  },
  {
    id: 4,
    title: "Chilled Beverages",
    tag: "FRESHO!",
    // img: "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&q=80&w=500",
    img: Unsplash4,
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
        {/* <span className="bg-[#2ecc71] text-white text-[9px] sm:text-[10px] font-bold px-3 py-1 rounded-full mb-2 sm:mb-3 uppercase tracking-wider">
          {item.tag}
        </span> */}

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

export default function FoodCategoryList() {
  return (
    <div className="py-10 md:py-14 flex justify-center">
      <div className="container">

        {/* Heading */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="home-section-heading font-[800] text-2xl md:text-[35px] pb-2">
            American Category
          </h2>
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-green-500 mb-2" aria-hidden="true" />
          <p className="home-section-subheading text-sm sm:text-base md:text-lg font-semibold text-slate-800">
            Explore authentic flavors from American
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
