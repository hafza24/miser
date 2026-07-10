import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Smartphone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteFooter } from './SitePage';

const APK_URL = '/app-release.apk'; // Admin places APK at public/app-release.apk

const DownloadPage = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const enableNotifications = async () => {
    try {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && Notification.permission === 'granted') {
          reg.showNotification('Fur&Fir notifications enabled', {
            body: "You'll get alerts for messages, matches and mentions.",
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: 'welcome',
          });
        }
      }
    } catch {}
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    }
    await enableNotifications();
  };

  const handleApkClick = async () => {
    // Fire notification permission alongside APK download
    await enableNotifications();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading text-lg font-bold text-foreground">Download Fur&amp;Fir</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-12 flex flex-col items-center gap-8">
        <div className="text-5xl">📲</div>
        <div className="text-center space-y-2">
          <h2 className="font-heading text-2xl font-bold text-foreground">Get Fur&amp;Fir</h2>
          <p className="text-muted-foreground text-sm">Take your connections on the go</p>
        </div>

        <div className="w-full space-y-4">
          {/* Android APK download */}
          <a
            href={APK_URL}
            download
            onClick={handleApkClick}
            className="flex items-center gap-4 bg-card rounded-2xl p-5 shadow-card border border-border hover:border-primary/30 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors">Download for Android</h3>
              <p className="text-xs text-muted-foreground">APK file • Installer enables notifications</p>
            </div>
            <Download className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          {/* PWA Install */}
          <button
            onClick={handleInstallPWA}
            disabled={isInstalled}
            className="w-full flex items-center gap-4 bg-card rounded-2xl p-5 shadow-card border border-border hover:border-primary/30 transition-colors group disabled:opacity-60 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <Globe className="h-6 w-6 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
                {isInstalled ? 'Already Installed' : 'Install Web App'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isInstalled 
                  ? 'Fur&Fir is installed on your device' 
                  : deferredPrompt 
                    ? 'Add to home screen • Works offline'
                    : 'Open in browser and use "Add to Home Screen"'}
              </p>
            </div>
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          The Android APK requires enabling "Install from unknown sources" in your device settings.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
};

export default DownloadPage;
