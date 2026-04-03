import logo from "@/assets/logo.png";

const Footer = () => (
  <footer className="bg-foreground text-primary-foreground py-6 sm:py-10 md:py-14">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="grid md:grid-cols-3 gap-5 sm:gap-8 md:gap-10">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <img src={logo} alt="Zippyyy Ships" className="h-8 w-8 sm:h-10 sm:w-10" />
            <span className="text-lg sm:text-xl font-bold">Zippyyy Ships</span>
          </div>
          <p className="text-xs sm:text-sm opacity-60 max-w-xs leading-relaxed">
            Beyond groceries — professional logistics for everything else. 
            Delivering nationally and internationally at rates that make sense.
          </p>
        </div>
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-semibold opacity-40 mb-2 sm:mb-4">Services</h4>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm opacity-60">
            <li>National Shipping</li>
            <li>International Freight</li>
            <li>Bulk Orders</li>
            <li>Business Partnerships</li>
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-semibold opacity-40 mb-2 sm:mb-4">Contact</h4>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm opacity-60">
            <li>zippyyycare@gmail.com</li>
            <li>24/7 Customer Support</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 mt-5 sm:mt-8 md:mt-10 pt-4 sm:pt-6 md:pt-8 text-center text-[11px] sm:text-xs opacity-40">
        © {new Date().getFullYear()} Zippyyy Ships. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
