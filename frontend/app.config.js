// Dynamic Expo config (replaces the old static app.json).
//
// Maps use MapLibre (@maplibre/maplibre-react-native) with free OpenFreeMap
// vector tiles (https://openfreemap.org) — no API key, no billing account,
// no usage cap, unlike Google/Mapbox. See src/components/AppMap.native.tsx.
module.exports = () => ({
  expo: {
    name: 'WakaWaka',
    slug: 'wakawaka',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'wakawaka',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.exitmedia.wakawaka',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'WakaWaka uses your location to show nearby riders, set your pickup point, and track deliveries in real time.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
      package: 'com.exitmedia.wakawaka',
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-image.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#000000',
        },
      ],
      'expo-font',
      '@maplibre/maplibre-react-native',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wakawaka-production.up.railway.app',
    },
  },
});
