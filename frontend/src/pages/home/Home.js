import "../../styles/pages/Home.css";
import CustomSlider from "./components/CustomSlider";
import HomeHero from "./components/HomeHero";
import FeaturedCategories from "./components/FeaturedCategories";
import PopularProducts from "./components/PopularProducts";
import ProductColumns from "./components/ProductColumns";
import RecentlyViewedProducts from "./components/RecentlyViewedProducts";

export default function Home() {
    return (
        <div className="home-page-wrapper">
            <HomeHero />
            <FeaturedCategories />
            <CustomSlider />
            <PopularProducts />
            <ProductColumns />
            <RecentlyViewedProducts />
        </div>
    );
}