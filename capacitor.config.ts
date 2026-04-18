import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.eae9743ef7d4438dbfb8c27f25184241',
  appName: 'LEVONIS',
  webDir: 'dist',
  server: {
    url: 'https://eae9743e-f7d4-438d-bfb8-c27f25184241.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#103d33',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#103d33',
    },
  },
};

export default config;
