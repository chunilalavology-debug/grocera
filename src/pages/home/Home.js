import "../../styles/pages/Home.css";
import CustomSlider from "./components/CustomSlider";
import GroceryBanner from "./components/GroceryBanner";
import GroceryBannerTrue from "./components/GroceryBannerTrue";
import GroceryPage from "./components/GroceryPage";
import GroceryPageend from "./components/GroceryPageend";
import HomeHero from "./components/HomeHero";
import FeaturedCategories from "./components/FeaturedCategories";

export default function Home() {
    return (
        <>
            <HomeHero />
            <FeaturedCategories />
            <CustomSlider />
            <GroceryBanner />
            <GroceryPage />
            <GroceryBannerTrue />
            <GroceryPageend />
        </>
    )
}