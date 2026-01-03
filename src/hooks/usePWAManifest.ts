import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type AppMode = 'delivery' | 'admin' | 'default';

const getAppMode = (): AppMode => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Check subdomain first
  if (hostname.startsWith('delivery.') || hostname.startsWith('delivery-')) {
    return 'delivery';
  }
  if (hostname.startsWith('admin.') || hostname.startsWith('admin-')) {
    return 'admin';
  }

  // Check route path
  if (pathname.startsWith('/delivery')) {
    return 'delivery';
  }
  if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
    return 'admin';
  }

  return 'default';
};

const manifestConfig = {
  delivery: {
    manifest: '/manifest-delivery.json',
    themeColor: '#f97316',
    title: 'Food Delivery',
    appleIcon: '/delivery-icon-192.png'
  },
  admin: {
    manifest: '/manifest-admin.json',
    themeColor: '#22c55e',
    title: 'Food Comanda Admin',
    appleIcon: '/admin-icon-192.png'
  },
  default: {
    manifest: '/manifest.webmanifest',
    themeColor: '#22c55e',
    title: 'Food Comanda Pro',
    appleIcon: '/pwa-icon-192.png'
  }
};

export const usePWAManifest = () => {
  const location = useLocation();

  useEffect(() => {
    const mode = getAppMode();
    const config = manifestConfig[mode];

    // Update manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = config.manifest;

    // Update theme color
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (themeColorMeta) {
      themeColorMeta.content = config.themeColor;
    }

    // Update apple touch icon
    const appleIcons = document.querySelectorAll('link[rel="apple-touch-icon"]') as NodeListOf<HTMLLinkElement>;
    appleIcons.forEach(icon => {
      icon.href = config.appleIcon;
    });

    // Update document title based on mode
    if (mode !== 'default') {
      document.title = config.title;
    }
  }, [location.pathname]);
};

export default usePWAManifest;
