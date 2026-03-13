import banner from "../../../assets-copy/banner/banner.webp";

const HomeHero = () => (
    <section className="home-hero">
        <div className="home-hero__image-wrap">
            <img
                src={banner}
                alt="Fresh groceries delivered"
                className="home-hero__image"
            />
            <div className="home-hero__overlay" aria-hidden="true" />
        </div>
    </section>
);

export default HomeHero;
