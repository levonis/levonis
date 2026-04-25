import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.levonis.iq',
  appName: 'levonis',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#103d33',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#103d33',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#103d33',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#103d33',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
