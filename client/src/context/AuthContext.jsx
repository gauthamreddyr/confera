import { createContext, useContext, useEffect, useState } from "react";
import { getMe, signIn as apiSignIn, signOut as apiSignOut } from "../lib/auth.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMe();
        if (data?.user) setUser(data.user);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const data = await apiSignIn({ email, password });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await apiSignOut();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
