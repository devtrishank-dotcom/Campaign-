import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";
import { applyTheme } from "./theme";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [theme, setThemeState] = useState("gold");
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setPermissions(data.permissions || []);
      setThemeState(applyTheme(data.theme || "gold"));
    } catch {
      localStorage.removeItem("token");
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    setPermissions(data.permissions || []);
    setThemeState(applyTheme(data.theme || "gold"));
    return data.user;
  };

  const setTheme = async (key) => {
    const { data } = await api.put("/auth/theme", { theme: key });
    setThemeState(applyTheme(data.theme || key));
    return data.theme;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setPermissions([]);
    window.location.href = "/login";
  };

  const hasPermission = (perm) => {
    if (!perm) return true;
    if (user?.role === "super_admin") return true;
    return permissions.includes(perm);
  };

  return (
    <AuthContext.Provider
      value={{ user, permissions, theme, loading, login, logout, hasPermission, setTheme, refresh: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
