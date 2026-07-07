// Payment WebView screen. Opens Paystack (or mock) authorization URL,
// detects the /api/payments/callback redirect, then verifies with backend.
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useAuth } from '@/src/context/auth';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Colors, Fonts, Radii, Shadows, Spacing } from '@/src/theme';

const CALLBACK_MARKER = '/api/payments/callback';

export default function PaymentScreen() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const params = useLocalSearchParams<{
    deliveryId: string;
    reference: string;
    authorizationUrl: string;
    isMock?: string;
  }>();
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const verifiedRef = useRef(false);

  const runVerify = useCallback(async () => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    setVerifying(true);
    try {
      const res = await apiFetch('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: params.reference }),
      });
      if (res.paymentStatus === 'PAID') {
        router.replace(`/(customer)/tracking/${params.deliveryId}`);
      } else {
        setFailed(true);
        verifiedRef.current = false;
      }
    } catch (e) {
      setFailed(true);
      verifiedRef.current = false;
    } finally {
      setVerifying(false);
    }
  }, [apiFetch, params.deliveryId, params.reference, router]);

  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      if (nav.url && nav.url.includes(CALLBACK_MARKER)) {
        runVerify();
      }
    },
    [runVerify]
  );

  const cancelAndGoBack = () => {
    router.replace('/(customer)/home');
  };

  // Web fallback: open in same tab (WebView not reliable on RN Web)
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={cancelAndGoBack} style={styles.backBtn} testID="payment-cancel-button">
            <MaterialCommunityIcons name="close" size={22} color={Colors.asphaltBlack} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Payment</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.webFallback} testID="payment-web-fallback">
          <MaterialCommunityIcons name="credit-card-check-outline" size={64} color={Colors.okadaOrange} />
          <Text style={styles.webTitle}>Ready to pay</Text>
          <Text style={styles.webSub}>
            {params.isMock === '1'
              ? 'Running in DEMO mode. The checkout will open in a new tab.'
              : 'You will be redirected to a secure Paystack page.'}
          </Text>
          <PrimaryButton
            title="Open payment page"
            onPress={() => Linking.openURL(params.authorizationUrl as string)}
            testID="payment-open-external"
          />
          <View style={{ height: 12 }} />
          <PrimaryButton
            title="I've completed payment — verify"
            variant="outline"
            onPress={runVerify}
            loading={verifying}
            testID="payment-verify-manual"
          />
          {failed && (
            <Text style={styles.errorTxt} testID="payment-error">
              Payment not confirmed yet. Complete the checkout, then tap Verify.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={cancelAndGoBack} style={styles.backBtn} testID="payment-cancel-button">
          <MaterialCommunityIcons name="close" size={22} color={Colors.asphaltBlack} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Secure Checkout</Text>
          <View style={styles.secureRow}>
            <MaterialCommunityIcons name="shield-check" size={12} color={Colors.success} />
            <Text style={styles.secureTxt}>
              {params.isMock === '1' ? 'Demo mode' : 'Paystack'}
            </Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>
      <View style={{ flex: 1 }}>
        <WebView
          testID="payment-webview"
          source={{ uri: params.authorizationUrl as string }}
          onNavigationStateChange={onNavChange}
          onLoadEnd={() => setWebLoading(false)}
          startInLoadingState
        />
        {webLoading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.okadaOrange} />
            <Text style={styles.overlayTxt}>Loading secure checkout…</Text>
          </View>
        )}
        {verifying && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.okadaOrange} />
            <Text style={styles.overlayTxt}>Confirming payment…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.headingBold, fontSize: 16, fontWeight: '800', color: Colors.asphaltBlack },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  secureTxt: { fontFamily: Fonts.bodyBold, fontSize: 11, color: Colors.textSecondary, marginLeft: 4, fontWeight: '700' },
  webFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  webTitle: {
    fontFamily: Fonts.headingBold, fontSize: 24, color: Colors.asphaltBlack, marginTop: 16, fontWeight: '800',
  },
  webSub: {
    fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: Spacing.lg,
  },
  errorTxt: {
    fontFamily: Fonts.body, color: Colors.error, fontSize: 13, marginTop: 12, textAlign: 'center', fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlayTxt: { fontFamily: Fonts.bodyBold, marginTop: 12, color: Colors.asphaltBlack, fontSize: 15, fontWeight: '700' },
});
