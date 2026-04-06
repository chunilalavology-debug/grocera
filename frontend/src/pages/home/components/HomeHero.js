import banner from "../../../assets-copy/banner/banner.webp";
import { useSiteBranding } from "../../../context/SiteBrandingContext";

const HomeHero = () => {
    const { siteSettings } = useSiteBranding();
    const heroImage = siteSettings?.heroBanner?.image || banner;
    const overlayColor = siteSettings?.heroBanner?.overlayColor || "rgba(0,0,0,0.45)";

    return (
        <section className="home-hero">
            <div className="home-hero__image-wrap">
                <img
                    src={heroImage}
                    alt="Fresh groceries delivered"
                    className="home-hero__image"
                    loading="eager"
                    onError={(e) => {
                        e.currentTarget.src = banner;
                    }}
                />
                <div
                    className="home-hero__overlay"
                    aria-hidden="true"
                    style={{ background: overlayColor }}
                />
            </div>
        </section>
    );
};

export default HomeHero;
