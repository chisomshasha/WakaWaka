import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { AuthProvider, useAuth } from '@/src/context/auth';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const inCustomer = segments[0] === '(customer)';
    const inRider = segments[0] === '(rider)';
    const inRoleSelection = segments[0] === 'role-selection';

    if (!user) {
      // Not logged in: only allow (auth) and role-selection
      if (!inAuth && !inRoleSelection) {
        router.replace('/role-selection');
      }
      return;
    }
    // Logged in: route to correct group
    if (user.role === 'CLIENT' && !inCustomer) {
      router.replace('/(customer)/home');
    } else if (user.role === 'RIDER' && !inRider) {
      router.replace('/(rider)/home');
    }
  }, [user, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
