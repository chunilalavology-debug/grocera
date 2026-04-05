import { useState } from "react";
import { ArrowLeft, Menu, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Ships app header: mobile = Back | centered logo | hamburger.
 * Desktop (lg+) = Back + logo + inline links.
 */
const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const goBackToGrocery = () => {
    try {
      const p = window.parent;
      if (p && p !== window) {
        if (p.history.length > 1) {
          p.history.back();
        } else {
          p.location.assign(`${p.location.origin}/`);
        }
        return;
      }
    } catch {
      /* cross-origin parent */
    }

    const envHome = import.meta.env.VITE_STOREFRONT_HOME_URL?.trim();
    if (envHome) {
      window.location.assign(envHome);
      return;
    }

    const ref = document.referrer;
    if (ref) {
      try {
        const refUrl = new URL(ref);
        const here = new URL(window.location.href);
        const rp = refUrl.pathname.replace(/\/+$/, "") || "/";
        const isShipsOnly =
          /\/zippyyy-ships-app$/i.test(rp) ||
          rp.endsWith("/zippyyy-ships") ||
          rp.includes("/zippyyy-ships-app/");
        if (refUrl.origin === here.origin && !isShipsOnly) {
          window.location.assign(ref);
          return;
        }
      } catch {
        /* ignore */
      }
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/");
  };

  const scrollToHero = () => {
    document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" });
  };

  const goToSection = (id: string) => {
    setMenuOpen(false);
    const run = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };
    if (pathname !== "/") {
      navigate("/");
      window.setTimeout(run, 200);
    } else {
      run();
    }
  };

  const navBtnClass =
    "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap";

  const BackBtn = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={goBackToGrocery}
      className={cn(
        "inline-flex items-center justify-center gap-1 sm:gap-1.5 shrink-0 rounded-lg bg-[#e9aa42] px-2 py-2 sm:px-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-[#d89b38] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9aa42] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      aria-label="Back to Zippyyy store"
    >
      <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="hidden min-[400px]:inline pr-0.5">Back</span>
    </button>
  );

  const LogoBlock = ({ compact }: { compact?: boolean }) => (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        if (pathname !== "/") navigate("/");
        else scrollToHero();
      }}
      className={cn(
        "flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-left min-w-0 max-w-full",
        compact && "flex-col sm:flex-row gap-0.5 sm:gap-2"
      )}
    >
      <img
        src={logo}
        alt=""
        className={cn("object-contain shrink-0", compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-9 w-9 sm:h-10 sm:w-10")}
      />
      <span
        className={cn(
          "font-bold text-foreground tracking-tight truncate text-center leading-tight",
          compact ? "text-xs sm:text-sm md:text-base" : "text-lg sm:text-xl"
        )}
      >
        Zippyyy <span className="text-primary">Ships</span>
      </span>
    </button>
  );

  const NavLinks = ({ vertical }: { vertical?: boolean }) => (
    <div
      className={cn(
        "flex items-center",
        vertical ? "flex-col items-stretch gap-1" : "flex-wrap justify-end gap-x-5 gap-y-2"
      )}
    >
      <button type="button" className={cn(navBtnClass, vertical && "py-3 px-2 text-left rounded-lg hover:bg-muted/60")} onClick={() => goToSection("hero")}>
        Ship Now
      </button>
      <button
        type="button"
        className={cn(navBtnClass, vertical && "py-3 px-2 text-left rounded-lg hover:bg-muted/60")}
        onClick={() => goToSection("how-it-works")}
      >
        How It Works
      </button>
      <button type="button" className={cn(navBtnClass, vertical && "py-3 px-2 text-left rounded-lg hover:bg-muted/60")} onClick={() => goToSection("business")}>
        Business
      </button>
      <Link
        to="/tracking"
        className={cn(
          navBtnClass,
          "inline-flex items-center gap-1.5",
          vertical && "py-3 px-2 rounded-lg hover:bg-muted/60"
        )}
        onClick={() => setMenuOpen(false)}
      >
        <Search className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        Track
      </Link>
      <button
        type="button"
        onClick={() => goToSection("quote")}
        className={cn(
          vertical
            ? "mt-2 rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground hover:opacity-95"
            : "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95 shrink-0"
        )}
      >
        Get a Quote
      </button>
    </div>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
      {/* Mobile: stacked logo is taller than 56px — fixed h-14 clipped it into the hero; use min-height + padding instead */}
      <div className="container mx-auto px-3 sm:px-6 lg:h-16">
        {/* Mobile / tablet: 3 columns — back | logo | menu */}
        <div className="lg:hidden grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3 w-full py-2.5 sm:py-3">
          <div className="justify-self-start min-w-0">
            <BackBtn />
          </div>
          <div className="justify-self-center min-w-0 px-1 flex justify-center overflow-hidden">
            <LogoBlock compact />
          </div>
          <div className="justify-self-end">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100vw-2rem,20rem)] sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 pr-2" aria-label="Mobile navigation">
                  <NavLinks vertical />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden lg:flex items-center justify-between gap-6 h-full w-full">
          <div className="flex items-center gap-5 shrink-0">
            <BackBtn />
            <LogoBlock />
          </div>
          <NavLinks />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
