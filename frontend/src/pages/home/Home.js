import "../../styles/pages/Home.css";
import ScrollReveal from "../../components/ScrollReveal";
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
            <ScrollReveal>
                <FeaturedCategories />
            </ScrollReveal>
            <ScrollReveal>
                <CustomSlider />
            </ScrollReveal>
            <ScrollReveal>
                <PopularProducts />
            </ScrollReveal>
            <ScrollReveal>
                <ProductColumns />
            </ScrollReveal>
            <ScrollReveal>
                <RecentlyViewedProducts />
            </ScrollReveal>
        </div>
    );
}