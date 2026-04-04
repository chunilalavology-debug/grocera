import { motion } from "framer-motion";

interface Box3DProps {
  length: number;
  width: number;
  height: number;
}

const Box3DPreview = ({ length, width, height }: Box3DProps) => {
  // Normalize dimensions to fit in the container (max ~120px)
  const maxDim = Math.max(length, width, height, 1);
  const scale = 80 / maxDim;
  const w = Math.max(width * scale, 12);
  const h = Math.max(height * scale, 12);
  const d = Math.max(length * scale, 12);

  // Isometric-like projection
  const topSkewX = d * 0.7;
  const sideSkewY = d * 0.7;

  return (
    <div className="flex items-center justify-center py-6">
      <motion.div
        className="relative"
        style={{ width: w + topSkewX + 4, height: h + sideSkewY + 4 }}
        animate={{ rotateY: [0, 5, -5, 0], rotateX: [-3, 3, -3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Front face */}
        <motion.div
          className="absolute rounded-lg"
          style={{
            width: w,
            height: h,
            bottom: 0,
            left: 0,
            background: "linear-gradient(135deg, hsl(18 100% 50%), hsl(18 100% 40%))",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.15)",
          }}
          animate={{ scale: [1, 1.01, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Cross tape */}
          <div
            className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2"
            style={{
              width: Math.max(w * 0.12, 3),
              background: "rgba(255,255,255,0.25)",
            }}
          />
        </motion.div>

        {/* Top face */}
        <motion.div
          className="absolute rounded-t-lg"
          style={{
            width: w,
            height: topSkewX,
            bottom: h,
            left: 0,
            background: "linear-gradient(180deg, hsl(18 100% 60%), hsl(18 100% 50%))",
            transform: `skewX(-45deg) translateX(${topSkewX / 2}px)`,
            transformOrigin: "bottom left",
          }}
          animate={{ scale: [1, 1.01, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        >
          <div
            className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2"
            style={{
              width: Math.max(w * 0.12, 3),
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </motion.div>

        {/* Right face */}
        <motion.div
          className="absolute rounded-r-lg"
          style={{
            width: topSkewX,
            height: h,
            bottom: 0,
            left: w,
            background: "linear-gradient(90deg, hsl(18 100% 38%), hsl(18 100% 32%))",
            transform: `skewY(-45deg) translateY(-${sideSkewY / 2}px)`,
            transformOrigin: "top left",
          }}
          animate={{ scale: [1, 1.01, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />

        {/* Glow effect */}
        <div
          className="absolute -inset-4 rounded-2xl opacity-30 blur-xl"
          style={{
            background: "radial-gradient(circle, hsl(18 100% 50% / 0.3) 0%, transparent 70%)",
          }}
        />
      </motion.div>

      {/* Dimension labels */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground font-mono">
        <span>{length}"L</span>
        <span>×</span>
        <span>{width}"W</span>
        <span>×</span>
        <span>{height}"H</span>
      </div>
    </div>
  );
};

export default Box3DPreview;
