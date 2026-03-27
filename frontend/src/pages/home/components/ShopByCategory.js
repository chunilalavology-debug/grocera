import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MAIN_CATEGORIES } from '../../../config/categories';
import vegetables from "../../../assets-copy/category/vegetables.png";
import Unsplash1 from "../../../assets-copy/home/photo1.png";
import Unsplash3 from "../../../assets-copy/home/photo3.png";
import chineseFood from "../../../assets-copy/chinese/cook.svg";

const MAIN_IMAGES = {
  indian: vegetables,
  american: Unsplash1,
  chinese: chineseFood,
  turkish: Unsplash3,
};

export default function ShopByCategory() {
  const mains = MAIN_CATEGORIES.filter((m) => m.id !== 'all');

  return (
    <section className="shop-by-category pt-5 md:pt-20 pb-10 md:pb-20">
      <div className="container">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="font-[800] text-2xl md:text-[35px] pb-2 text-slate-900">
            Shop By Category
          </h2>
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-[#3090cf] mb-2" aria-hidden="true" />
          <p className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">
            Explore Indian, American, Chinese & Turkish groceries
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {mains.map((main, idx) => (
            <Link
              key={main.id}
              to={`/products?main=${main.id}`}
              className="group block bg-white rounded-2xl md:rounded-[30px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 hover:border-[#3090cf]/30"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="p-2 sm:p-3">
                <div className="h-40 sm:h-52 md:h-56 w-full rounded-xl md:rounded-[25px] overflow-hidden bg-slate-100">
                  <img
                    src={MAIN_IMAGES[main.id] || vegetables}
                    alt={main.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
              <div className="px-4 sm:px-5 pb-5 sm:pb-6 pt-2 text-center flex flex-col items-center">
                <h3 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800">
                  {main.name}
                </h3>
                <span className="mt-3 inline-flex items-center text-xs sm:text-sm font-bold text-[#3090cf] group-hover:underline">
                  Explore
                  <ArrowRight className="ml-1 w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
