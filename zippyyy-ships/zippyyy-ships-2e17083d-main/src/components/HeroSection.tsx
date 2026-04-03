import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Plane, Package, Globe, Truck, Shield, Zap } from "lucide-react";
import heroPlane from "@/assets/hero-plane.png";
import deliveryTruck from "@/assets/delivery-truck.png";
import shippingBox from "@/assets/shipping-box.png";

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const planeY = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const planeRotate = useTransform(scrollYProgress, [0, 1], [0, 8]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const badgeOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const scrollToQuote = () => {
    document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative isolate min-h-0 sm:min-h-[min(100dvh,880px)] md:min-h-screen flex items-start sm:items-center overflow-hidden pt-14 pb-5 sm:pt-20 sm:pb-12 md:pt-24 md:pb-16 lg:pt-16 lg:pb-0"
    >
      {/* Animated background gradient blobs with parallax — z-0 so copy/CTAs stay above */}
      <motion.div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ scale: bgScale }}
        aria-hidden
      >
        <motion.div
          className="absolute top-10 left-5 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-10 right-5 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px]"
          animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-primary/3 rounded-full blur-[80px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating decorative icons — only on lg+ so they never overlap CTAs on mobile/tablet */}
        <motion.div
          animate={{ y: [0, -25, 0], rotate: [0, 10, -5, 0], x: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-28 right-[12%] hidden lg:block"
        >
          <Package size={48} className="text-primary/10" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -15, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[28%] right-[8%] hidden lg:block"
        >
          <Globe size={56} className="text-primary/10" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[55%] right-[6%] hidden lg:block"
        >
          <Truck size={36} className="text-primary/10" />
        </motion.div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-12 items-center relative z-10 w-full">
        {/* Left: Copy with parallax */}
        <motion.div className="max-w-2xl w-full min-w-0 relative z-20" style={{ y: textY }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex items-center gap-2 mb-4 sm:mb-6"
          >
            <motion.span
              className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground bg-secondary px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
              animate={{ boxShadow: ["0 0 0px hsl(18 100% 50% / 0)", "0 0 15px hsl(18 100% 50% / 0.15)", "0 0 0px hsl(18 100% 50% / 0)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              National & International Shipping
            </motion.span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-foreground text-balance leading-[1.05] sm:leading-[0.98]"
          >
            Beyond Groceries.{" "}
            <motion.span
              className="text-primary inline-block"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              Logistics
            </motion.span>{" "}
            for everything else.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
          >
            Ship your goods nationally and internationally at rates that make sense. 
            More affordable than local vendors, powered by professional logistics networks.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 relative z-20"
          >
            <motion.button
              onClick={scrollToQuote}
              type="button"
              className="w-full sm:w-auto min-h-[48px] px-6 sm:px-8 py-3.5 sm:py-4 bg-primary text-primary-foreground font-bold rounded-full text-sm sm:text-base shadow-glow inline-flex items-center justify-center gap-2 relative overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Shimmer — behind icon/text only */}
              <motion.div
                className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
              />
              <Plane size={18} className="relative z-[1] shrink-0" />
              <span className="relative z-[1]">Get Your Quote</span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto min-h-[48px] px-6 sm:px-8 py-3.5 sm:py-4 bg-secondary text-secondary-foreground font-semibold rounded-full text-sm sm:text-base inline-flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02, backgroundColor: "hsl(var(--secondary) / 0.85)" }}
              whileTap={{ scale: 0.98 }}
            >
              How It Works
              <ArrowDown size={16} />
            </motion.button>
          </motion.div>

          {/* Stats with staggered counter animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-5 sm:mt-10 md:mt-12 flex flex-wrap items-start sm:items-center gap-4 sm:gap-6 md:gap-8"
          >
            {[
              { value: "150+", label: "Countries", icon: Globe },
              { value: "25%", label: "Cheaper", icon: Zap },
              { value: "24/7", label: "Support", icon: Shield },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="group min-w-[5.5rem]"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <stat.icon size={14} className="text-primary opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                  <div className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums">{stat.value}</div>
                </div>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right: 3D Hero with parallax */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative flex justify-center items-center lg:min-h-[min(520px,50vh)] mt-1 sm:mt-3 lg:mt-0 -mx-2 sm:mx-0"
          style={{ y: planeY }}
        >
          {/* Radial glow behind plane */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-full"
              style={{ background: "radial-gradient(circle, hsl(18 100% 50% / 0.08) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <motion.img
            src={heroPlane}
            alt="3D Cargo Plane with shipping containers"
            className="w-full max-w-[min(100%,26rem)] max-h-[min(32vh,260px)] sm:max-h-none object-contain drop-shadow-2xl relative z-10"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{ rotate: planeRotate }}
          />

          {/* Floating 3D elements */}
          <motion.img
            src={shippingBox}
            alt=""
            className="absolute top-5 left-5 w-14 drop-shadow-lg hidden lg:block"
            animate={{ y: [0, -12, 0], rotate: [0, 10, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            style={{ opacity: badgeOpacity }}
          />
          <motion.img
            src={deliveryTruck}
            alt=""
            className="absolute bottom-5 left-0 w-20 drop-shadow-lg hidden lg:block"
            animate={{ y: [0, -8, 0], x: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            style={{ opacity: badgeOpacity }}
          />

          {/* Floating badge cards */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute top-14 right-0 bg-card/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-float border border-border/30 hidden lg:block"
            style={{ opacity: badgeOpacity }}
          >
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Plane size={14} className="text-primary" /> Air Freight
            </span>
          </motion.div>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className="absolute bottom-24 right-4 bg-card/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-float border border-border/30 hidden lg:block"
            style={{ opacity: badgeOpacity }}
          >
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Truck size={14} className="text-accent" /> Ground Shipping
            </span>
          </motion.div>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
            className="absolute bottom-2 right-20 bg-card/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-float border border-border/30 hidden lg:block"
            style={{ opacity: badgeOpacity }}
          >
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Globe size={14} className="text-primary" /> Ocean Cargo
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 hidden sm:block"
        animate={{ y: [0, 8, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ArrowDown className="text-muted-foreground" size={20} />
      </motion.div>
    </section>
  );
};

export default HeroSection;
