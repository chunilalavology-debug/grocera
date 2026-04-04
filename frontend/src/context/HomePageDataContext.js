import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const HomePageDataContext = createContext(null);

/** One catalog fetch for the whole home page (Popular + Product columns share this). */
export function HomePageDataProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get("/user/products", { params: { limit: 72 } });
        const list = res?.data || res?.products || [];
        if (!cancelled) {
          setProducts(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        if (!cancelled) {
          setProducts([]);
          setError(e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      homeProducts: products,
      homeProductsLoading: loading,
      homeProductsError: error,
    }),
    [products, loading, error],
  );

  return <HomePageDataContext.Provider value={value}>{children}</HomePageDataContext.Provider>;
}

export function useHomePageDataOptional() {
  return useContext(HomePageDataContext);
}
