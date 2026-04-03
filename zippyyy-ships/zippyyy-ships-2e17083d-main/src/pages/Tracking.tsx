import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, Truck, CheckCircle, MapPin, Clock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const MOCK_TRACKING_STEPS = [
  { status: "Order Placed", location: "New York, NY", date: "Mar 15, 2026 · 9:30 AM", icon: Package, completed: true },
  { status: "Picked Up", location: "New York Sorting Center", date: "Mar 15, 2026 · 2:15 PM", icon: Package, completed: true },
  { status: "In Transit", location: "Philadelphia, PA", date: "Mar 16, 2026 · 6:00 AM", icon: Truck, completed: true },
  { status: "Out for Delivery", location: "Washington, DC", date: "Mar 17, 2026 · 8:45 AM", icon: Truck, completed: false },
  { status: "Delivered", location: "Washington, DC", date: "Estimated", icon: CheckCircle, completed: false },
];

const TrackingPage = () => {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleTrack = () => {
    if (!trackingNumber.trim()) return;
    setIsTracking(true);
    setTimeout(() => {
      setIsTracking(false);
      setShowResults(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/3 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <nav className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Zippyyy Ships" className="h-10 w-10 object-contain" />
            <span className="text-xl font-bold text-foreground tracking-tight">
              Zippyyy <span className="text-primary">Ships</span>
            </span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="relative z-10 container mx-auto px-6 py-16 max-w-3xl">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center mb-12"
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">
            Real-Time Updates
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground mt-3">
            Track your shipment
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            Enter your tracking number to get instant updates on your package location.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
          className="bg-card rounded-3xl p-3 shadow-float-lg flex gap-3 mb-12"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
              placeholder="Enter tracking number (e.g. ZS-8294710384)"
              className="w-full bg-secondary p-4 pl-12 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground font-mono"
            />
          </div>
          <button
            onClick={handleTrack}
            disabled={isTracking}
            className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform shadow-glow disabled:opacity-60 whitespace-nowrap"
          >
            {isTracking ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Package size={20} />
              </motion.div>
            ) : (
              "Track"
            )}
          </button>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ ease: [0.2, 0.8, 0.2, 1] }}
            >
              {/* Summary card */}
              <div className="bg-card rounded-3xl p-6 shadow-float mb-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Tracking #</span>
                    <div className="font-mono font-bold text-foreground mt-1">{trackingNumber || "ZS-8294710384"}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Status</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span className="font-semibold text-foreground">In Transit</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Est. Delivery</span>
                    <div className="font-semibold text-foreground mt-1 flex items-center gap-1">
                      <Clock size={14} className="text-primary" />
                      Mar 17, 2026
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-card rounded-3xl p-8 shadow-float">
                <h3 className="text-lg font-bold text-foreground mb-8">Shipment Timeline</h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-8">
                    {MOCK_TRACKING_STEPS.map((step, i) => (
                      <motion.div
                        key={step.status}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i, ease: [0.2, 0.8, 0.2, 1] }}
                        className="flex gap-4 relative"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${
                            step.completed
                              ? "bg-primary text-primary-foreground shadow-glow"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <step.icon size={18} />
                        </div>
                        <div className="pt-1.5">
                          <div className={`font-semibold text-sm ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                            {step.status}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <MapPin size={12} />
                            {step.location}
                          </div>
                          <div className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{step.date}</div>
                        </div>
                        {step.completed && i === MOCK_TRACKING_STEPS.filter(s => s.completed).length - 1 && (
                          <motion.div
                            className="absolute left-[15px] top-0 w-2 h-full"
                            initial={{ height: 0 }}
                            animate={{ height: "100%" }}
                          >
                            <div className="w-0.5 h-full bg-primary ml-[3px]" />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TrackingPage;
