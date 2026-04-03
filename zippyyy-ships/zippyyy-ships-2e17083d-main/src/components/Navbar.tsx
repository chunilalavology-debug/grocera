import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollTo("hero")}>
          <img src={logo} alt="Zippyyy Ships" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold text-foreground tracking-tight">
            Zippyyy <span className="text-primary">Ships</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Ship Now", id: "quote" },
            { label: "How It Works", id: "how-it-works" },
            { label: "Business", id: "business" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </button>
          ))}
          <Link
            to="/tracking"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Search size={14} />
            Track
          </Link>
          <button
            onClick={() => scrollTo("quote")}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-full text-sm hover:scale-105 active:scale-95 transition-transform shadow-glow"
          >
            Get a Quote
          </button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-2 sm:gap-3">
              {[
                { label: "Ship Now", id: "quote" },
                { label: "How It Works", id: "how-it-works" },
                { label: "Business", id: "business" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-left py-2 text-foreground font-medium"
                >
                  {item.label}
                </button>
              ))}
              <Link
                to="/tracking"
                className="py-2 text-foreground font-medium flex items-center gap-2"
                onClick={() => setMobileOpen(false)}
              >
                <Search size={16} />
                Track Shipment
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
