import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, XCircle } from "lucide-react";

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/3 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 bg-card rounded-3xl p-8 shadow-float max-w-lg w-full text-center border border-border/30"
      >
        <XCircle className="text-muted-foreground mx-auto mb-4" size={44} />
        <h1 className="text-2xl font-bold text-foreground">Checkout canceled</h1>
        <p className="text-muted-foreground mt-2">
          No payment was made. You can go back and try again anytime.
        </p>

        <Link
          to="/#quote"
          className="inline-flex items-center justify-center gap-2 mt-6 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform shadow-glow"
        >
          <ArrowLeft size={16} />
          Back to quote
        </Link>
      </motion.div>
    </div>
  );
}

