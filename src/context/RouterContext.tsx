import React, { createContext, useContext, useState, useEffect } from 'react';

export function getSafeRedirectUrl(target?: string | null, fallback = '/'): string {
  if (!target || typeof target !== 'string') return fallback;
  try {
    const decoded = decodeURIComponent(target).trim();
    // Prevent open redirect: must start with single '/', not '//', and no protocol scheme
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('://')) {
      if (decoded.startsWith('/login')) return fallback;
      return decoded;
    }
  } catch (e) {
    // Malformed URI component
  }
  return fallback;
}

interface RouterContextType {
  currentPath: string;
  search: string;
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
  getRedirectUrl: (fallback?: string) => string;
}

const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  search: '',
  searchParams: new URLSearchParams(),
  navigate: () => {},
  getRedirectUrl: () => '/',
});

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialPath = () => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  };

  const getInitialSearch = () => {
    if (typeof window === 'undefined') return '';
    return window.location.search || '';
  };

  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);
  const [search, setSearch] = useState<string>(getInitialSearch);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setSearch(window.location.search || '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', to);
      try {
        const dummyBase = 'http://localhost';
        const url = new URL(to, dummyBase);
        setCurrentPath(url.pathname);
        setSearch(url.search);
      } catch (e) {
        const parts = to.split('?');
        setCurrentPath(parts[0] || '/');
        setSearch(parts[1] ? `?${parts[1]}` : '');
      }
      window.scrollTo(0, 0);
    }
  };

  const searchParams = new URLSearchParams(search);

  const getRedirectUrl = (fallback = '/') => {
    const param = searchParams.get('redirect') || searchParams.get('returnUrl');
    return getSafeRedirectUrl(param, fallback);
  };

  return (
    <RouterContext.Provider value={{ currentPath, search, searchParams, navigate, getRedirectUrl }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => useContext(RouterContext);
