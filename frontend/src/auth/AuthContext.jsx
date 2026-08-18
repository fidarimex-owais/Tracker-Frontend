import { useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import AuthContext from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    authService
      .getMe()
      .then((result) => {
        if (active) {
          setUser(result.user);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,

      async login(credentials) {
        const result = await authService.login(credentials);

        setUser(result.user);

        return result.user;
      },

      async signup(payload) {
        return authService.signup(payload);
      },

      async logout() {
        try {
          await authService.logout();
        } finally {
          setUser(null);
        }
      },
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}