import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth';
import { Colors } from '@/src/theme';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/role-selection');
    } else if (user.role === 'CLIENT') {
      router.replace('/(customer)/home');
    } else {
      router.replace('/(rider)/home');
    }
  }, [user, isLoading, router]);

  return (
    <View style={styles.container} testID="app-splash-loading">
      <ActivityIndicator size="large" color={Colors.okadaOrange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
