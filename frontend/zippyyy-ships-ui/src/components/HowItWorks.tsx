import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { MapPin, Box, Weight, CreditCard } from "lucide-react";
import deliveryTruck from "@/assets/delivery-truck.png";
import shippingBox from "@/assets/shipping-box.png";

const steps = [
  {
    icon: MapPin,
    title: "Enter Locations",
    description: "Input your origin and destination pin codes for instant route mapping.",
    step: "01",
  },
  {
    icon: Box,
    title: "Select Box Size",
    description: "Choose from preset shipping boxes or enter custom dimensions.",
    step: "02",
  },
  {
    icon: Weight,
    title: "Add Weight",
    description: "Enter the weight in pounds for accurate pricing.",
    step: "03",
  },
  {
    icon: CreditCard,
    title: "Pay & Ship",
    description: "Get your quote, pay securely, and download your shipping label instantly.",
    step: "04",
  },
];

const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const truckX = useTransform(scrollYProgress, [0, 1], [-100, 100]);

  return (
    <section ref={sectionRef} id="how-it-works" className="py-5 sm:py-12 md:py-20 lg:py-24 bg-surface relative overflow-hidden">
      {/* Parallax background elements */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <motion.img
          src={deliveryTruck}
          alt=""
          className="absolute -right-10 bottom-10 w-32 opacity-[0.04]"
          style={{ x: truckX }}
        />
        <motion.img
          src={shippingBox}
          alt=""
          className="absolute left-10 top-20 w-20 opacity-[0.04]"
          animate={{ rotate: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-5 sm:mb-10 md:mb-14 lg:mb-16"
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">
            Simple Process
          </span>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-foreground mt-1.5 sm:mt-3">
            Ship in 4 easy steps
          </h2>
          <p className="mt-2 sm:mt-4 text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-snug sm:leading-normal">
            From pickup to delivery, we make shipping effortless.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="relative bg-card p-4 sm:p-7 md:p-8 rounded-xl sm:rounded-3xl shadow-float group hover:shadow-float-lg transition-shadow cursor-default"
            >
              <motion.span
                className="text-6xl font-bold text-primary/10 absolute top-4 right-6 font-mono"
                whileHover={{ scale: 1.1, color: "hsl(18 100% 50% / 0.2)" }}
              >
                {step.step}
              </motion.span>
              <motion.div
                className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:shadow-glow transition-all duration-300"
              >
                <step.icon className="text-primary group-hover:text-primary-foreground transition-colors duration-300" size={22} />
              </motion.div>
              <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

              {/* Connecting line for desktop */}
              {i < 3 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5">
                  <motion.div
                    className="h-full bg-primary/20"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
