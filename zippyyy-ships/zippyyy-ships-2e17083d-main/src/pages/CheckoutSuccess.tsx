import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Download, Package, RefreshCcw, Truck } from "lucide-react";
import { apiGet } from "@/lib/api";

type ShipmentStatus = {
  checkoutSessionId: string;
  status: string;
  trackingNumber: string | null;
  labelReady: boolean;
  lastError: string | null;
};

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = useMemo(() => params.get("session_id"), [params]);
  const [data, setData] = useState<ShipmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const resp = await apiGet<ShipmentStatus>(`/api/shipments/${encodeURIComponent(sessionId)}`);
        if (!cancelled) setData(resp);
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load status");
      }
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-3xl p-8 shadow-float max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-foreground">Missing session</h1>
          <p className="text-muted-foreground mt-2">We couldn’t find a Stripe session id.</p>
          <Link to="/" className="inline-block mt-6 text-primary underline">Back home</Link>
        </div>
      </div>
    );
  }

  const ready = Boolean(data?.labelReady);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/3 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-16 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <CheckCircle className="text-primary mx-auto mb-4" size={48} />
          <h1 className="text-4xl font-bold tracking-tighter text-foreground">Payment received</h1>
          <p className="mt-3 text-muted-foreground">
            We’re generating your shipping label now. Keep this tab open.
          </p>
        </motion.div>

        <div className="bg-card rounded-3xl p-8 shadow-float border border-border/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Session</div>
              <div className="font-mono text-foreground mt-1 break-all">{sessionId}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center gap-2 justify-end">
                <span className={`w-2 h-2 rounded-full ${ready ? "bg-primary" : "bg-muted-foreground"} ${ready ? "" : "animate-pulse"}`} />
                <span className="font-semibold text-foreground">{data?.status ?? "processing"}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 bg-secondary rounded-2xl p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {data?.lastError && (
            <div className="mt-6 bg-secondary rounded-2xl p-4 text-sm text-destructive">
              {data.lastError}
            </div>
          )}

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            <div className="bg-secondary/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Package size={16} className="text-primary" />
                Tracking
              </div>
              <div className="mt-2 font-mono text-foreground">
                {data?.trackingNumber ?? "Pending…"}
              </div>
            </div>
            <div className="bg-secondary/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Truck size={16} className="text-primary" />
                Label
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {ready ? "Ready to download." : "Generating label…"}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              className={`flex-1 px-6 py-4 rounded-2xl font-bold text-center shadow-glow transition-transform ${
                ready ? "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-95" : "bg-secondary text-muted-foreground cursor-not-allowed"
              }`}
              href={ready ? `/api/shipments/${encodeURIComponent(sessionId)}/label` : undefined}
              onClick={(e) => {
                if (!ready) e.preventDefault();
              }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Download size={18} />
                Download label (PDF)
              </span>
            </a>
            <button
              className="px-6 py-4 rounded-2xl font-semibold bg-secondary text-foreground hover:scale-[1.02] active:scale-95 transition-transform"
              onClick={() => window.location.reload()}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw size={16} />
                Refresh
              </span>
            </button>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <Link to="/tracking" className="text-primary underline">
              Track a shipment
            </Link>
            <span className="mx-2">·</span>
            <Link to="/" className="text-primary underline">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

