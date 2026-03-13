import { useNavigate } from "react-router-dom";


import ricedaily from "../../../assets-copy/category/rice1.png";
import masalaspicy from "../../../assets-copy/category/masalaspicy.png";
import poojaitems from "../../../assets-copy/category/poojaitems.png";
import vegetables from "../../../assets-copy/category/vegetables.png";
import god from "../../../assets-copy/category/god.png";
import fruits from "../../../assets-copy/category/fruits.png";

const IndianCategory = () => {
    const navigate = useNavigate();
    return (
        <section className="home-category-section pt-5 md:pt-20 pb-10 md:pb-20">
            <div className="container">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                        { img: ricedaily, name: "Daily Essentials" },
                        { img: masalaspicy, name: "Spices & Masalas" },
                        { img: vegetables, name: "Fresh Vegetables" },
                        { img: poojaitems, name: "Pooja Items" },
                        { img: fruits, name: "Fresh Fruits" },
                        { img: god, name: "God Idols" },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => navigate("/products", { state: item.name })}
                            className="group cursor-pointer rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:shadow-xl hover:ring-green-500 transition-all duration-300"
                        >
                            <div className="aspect-square overflow-hidden rounded-xl bg-slate-50">
                                <img
                                    src={item.img}
                                    alt={item.name}
                                    width="150"
                                    height="150"
                                    className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                            <p className="mt-3 text-center text-sm font-bold text-slate-700">
                                {item.name}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default IndianCategory;
