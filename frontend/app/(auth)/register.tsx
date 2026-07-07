import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth, UserRole } from '@/src/context/auth';
import { Colors, Fonts, Spacing, Radii } from '@/src/theme';

export default function Register() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('Motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const [role, setRole] = useState<UserRole>((params.role as UserRole) || 'CLIENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || password.length < 6) {
      setError('Fill name, phone, and password (min 6 chars)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role,
        vehicleType: role === 'RIDER' ? vehicleType : undefined,
        licensePlate: role === 'RIDER' ? licensePlate : undefined,
      });
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="register-back-button">
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.asphaltBlack} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join thousands moving Lagos daily.</Text>
          </View>

          <View style={styles.roleSwitch}>
            <TouchableOpacity
              onPress={() => setRole('CLIENT')}
              style={[styles.roleBtn, role === 'CLIENT' && styles.roleBtnActive]}
              testID="register-role-customer"
            >
              <MaterialCommunityIcons name="package-variant-closed" size={16} color={role === 'CLIENT' ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.roleTxt, role === 'CLIENT' && styles.roleTxtActive]}>Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRole('RIDER')}
              style={[styles.roleBtn, role === 'RIDER' && styles.roleBtnActive]}
              testID="register-role-rider"
            >
              <MaterialCommunityIcons name="motorbike" size={16} color={role === 'RIDER' ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.roleTxt, role === 'RIDER' && styles.roleTxtActive]}>Rider</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <AppInput label="Full name" value={name} onChangeText={setName} placeholder="e.g. Ada Nwosu" testID="register-name-input" />
            <View style={{ height: Spacing.md }} />
            <AppInput
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+234 800 000 0000"
              keyboardType="phone-pad"
              autoCapitalize="none"
              testID="register-phone-input"
            />
            <View style={{ height: Spacing.md }} />
            <AppInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              testID="register-password-input"
            />

            {role === 'RIDER' && (
              <>
                <View style={{ height: Spacing.md }} />
                <AppInput
                  label="Vehicle type"
                  value={vehicleType}
                  onChangeText={setVehicleType}
                  placeholder="Motorcycle / Bicycle"
                  testID="register-vehicle-input"
                />
                <View style={{ height: Spacing.md }} />
                <AppInput
                  label="License plate"
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                  placeholder="e.g. LAG-123-XY"
                  autoCapitalize="characters"
                  testID="register-plate-input"
                />
              </>
            )}

            {error ? <Text style={styles.errorTxt} testID="register-error">{error}</Text> : null}
            <View style={{ height: Spacing.lg }} />
            <PrimaryButton title="Create Account" onPress={handleRegister} loading={loading} testID="register-submit-button" />

            <TouchableOpacity
              onPress={() => router.replace({ pathname: '/(auth)/login', params: { role } })}
              style={styles.linkRow}
              testID="register-goto-login"
            >
              <Text style={styles.linkTxt}>
                Already have an account? <Text style={styles.linkStrong}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginTop: 4 },
  header: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 30, fontWeight: '800', color: Colors.asphaltBlack, letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 15, color: Colors.textSecondary, marginTop: 6,
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: Radii.round,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  roleBtn: {
    flex: 1, height: 44, borderRadius: Radii.round,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    gap: 6,
  },
  roleBtnActive: {
    backgroundColor: Colors.asphaltBlack,
  },
  roleTxt: {
    fontFamily: Fonts.bodyBold, fontWeight: '700', fontSize: 14, color: Colors.textSecondary,
    marginLeft: 6,
  },
  roleTxtActive: { color: '#fff' },
  form: {},
  errorTxt: {
    fontFamily: Fonts.body, color: Colors.error, marginTop: Spacing.sm, fontSize: 13, fontWeight: '600',
  },
  linkRow: { marginTop: Spacing.md, alignItems: 'center' },
  linkTxt: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
  linkStrong: { fontFamily: Fonts.bodyBold, color: Colors.okadaOrange, fontWeight: '800' },
});
