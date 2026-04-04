import React, { createContext, useContext, useReducer, useEffect, useState } from "react";
import api from "../services/api";


const AuthContext = createContext();

const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };

    case "LOGOUT":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };

    case "UPDATE_USER":
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Loading state for spinner
  const [loading, setLoading] = useState(true);

  // Role helpers
  const isAdmin = state.user?.role === "admin";
  const isCoAdmin = state.user?.role === "co-admin";
  const isCustomer = state.user?.role === "customer";

  // Auto-login on refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      dispatch({ type: "SET_LOADING", payload: false });
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        const res = await api.get("/auth/profile");

        dispatch({
          type: "LOGIN_SUCCESS",
          payload: { user: res.user, token },
        });
      } catch (err) {
        console.error("Auto-login failed:", err);
        delete api.defaults.headers.common["Authorization"];
        dispatch({ type: "LOGOUT" });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // LOGIN
  const login = async (credentials) => {
    try {
      const res = await api.post("/auth/login", credentials);
      const payload = res?.data;
      const user = payload?.user;
      const tokens = payload?.tokens;
      const access = tokens?.access;

      if (!user || !access) {
        console.warn("Login response missing user or tokens:", res);
        return {
          success: false,
          message: res?.message || "Invalid response from server. Is the API URL correct?",
        };
      }

      localStorage.setItem("token", access);
      api.defaults.headers.common["Authorization"] = `Bearer ${access}`;

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user, token: access },
      });

      return { success: true, user };
    } catch (err) {
      console.error("Login failed:", err);
      return {
        success: false,
        message: err?.message || "Login failed",
      };
    }
  };

  // REGISTER
  const register = async (data) => {
    try {
      const res = await api.post("/auth/register", data);
      const { success, message } = res;

      if (!success) {
        return { success: false, message: message || "Registration failed" };
      }
      const { tokens, user } = res.data

      localStorage.setItem("token", tokens.access);
      api.defaults.headers.common["Authorization"] = `Bearer ${tokens.access}`;

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user, token: tokens.access },
      });

      return { success: true, user };
    } catch (err) {
      console.error("Registration failed:", err.response?.data || err);
      return {
        success: false,
        message: err.message || "Registration failed",
      };
    }
  };

  // LOGOUT
  const logout = () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    dispatch({ type: "LOGOUT" });
  };

  const value = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    loading, // for spinner

    // Roles
    isAdmin,
    isCoAdmin,
    isCustomer,

    // Functions
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
