import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Spacing, Radii } from '@/src/theme';

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const { login } = useAuth();
  const [phone, setPhone] = useState('+2348099999999');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(phone.trim(), password);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="login-back-button">
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.asphaltBlack} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.brandDot}>
              <MaterialCommunityIcons name="motorbike" color="#fff" size={26} />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue{params.role ? ` as ${params.role === 'CLIENT' ? 'Customer' : 'Rider'}` : ''}.
            </Text>
          </View>

          <View style={styles.form}>
            <AppInput
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+234 800 000 0000"
              keyboardType="phone-pad"
              autoCapitalize="none"
              testID="login-phone-input"
              leftIcon={<MaterialCommunityIcons name="phone" size={20} color={Colors.textSecondary} />}
            />
            <View style={{ height: Spacing.md }} />
            <AppInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoCapitalize="none"
              testID="login-password-input"
              leftIcon={<MaterialCommunityIcons name="lock" size={20} color={Colors.textSecondary} />}
            />
            {error ? <Text style={styles.errorTxt} testID="login-error">{error}</Text> : null}
            <View style={{ height: Spacing.lg }} />
            <PrimaryButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              testID="login-submit-button"
            />
            <TouchableOpacity
              onPress={() =>
                router.replace({ pathname: '/(auth)/register', params: { role: params.role } })
              }
              style={styles.linkRow}
              testID="login-goto-register"
            >
              <Text style={styles.linkTxt}>
                New to WakaWaka? <Text style={styles.linkStrong}>Create account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.demoCard} testID="login-demo-card">
            <Text style={styles.demoTitle}>Try the demo</Text>
            <Text style={styles.demoTxt}>Customer: +2348099999999 / password123</Text>
            <Text style={styles.demoTxt}>Rider: +2348011111111 / password123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, flexGrow: 1 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginTop: 4 },
  header: { marginTop: Spacing.md, marginBottom: Spacing.xl },
  brandDot: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.okadaOrange,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 32, fontWeight: '800', color: Colors.asphaltBlack, letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 15, color: Colors.textSecondary, marginTop: 6,
  },
  form: {},
  errorTxt: {
    fontFamily: Fonts.body,
    color: Colors.error, marginTop: Spacing.sm, fontSize: 13, fontWeight: '600',
  },
  linkRow: { marginTop: Spacing.md, alignItems: 'center' },
  linkTxt: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
  linkStrong: { fontFamily: Fonts.bodyBold, color: Colors.okadaOrange, fontWeight: '800' },
  demoCard: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  demoTitle: {
    fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, fontWeight: '800',
  },
  demoTxt: {
    fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary, marginTop: 2,
  },
});
