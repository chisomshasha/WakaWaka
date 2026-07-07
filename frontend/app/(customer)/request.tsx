import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

const DEFAULT_PICKUP = { name: 'Victoria Island', lat: 6.4281, lng: 3.4219 };
const DEFAULT_DROPOFF = { name: 'Lekki Phase 1', lat: 6.4474, lng: 3.4553 };

type PaymentMethod = 'CASH' | 'CARD' | 'WALLET';

export default function RequestDelivery() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const params = useLocalSearchParams<{ field?: string; lat?: string; lng?: string; address?: string; ts?: string }>();
  const [pickup, setPickup] = useState(DEFAULT_PICKUP);
  const [dropoff, setDropoff] = useState(DEFAULT_DROPOFF);
  const [pickupText, setPickupText] = useState(DEFAULT_PICKUP.name);
  const [dropoffText, setDropoffText] = useState(DEFAULT_DROPOFF.name);
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [estimate, setEstimate] = useState<{ distance: number; estimatedPrice: number; eta: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAppliedTs, setLastAppliedTs] = useState<string | null>(null);

  // Pick up the result of the location-picker screen (address search or GPS)
  // when it navigates back here with `field`/`lat`/`lng`/`address`/`ts` params.
  useEffect(() => {
    if (!params.ts || params.ts === lastAppliedTs) return;
    const lat = parseFloat(params.lat || '');
    const lng = parseFloat(params.lng || '');
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const point = { name: params.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
    if (params.field === 'dropoff') {
      setDropoff(point);
      setDropoffText(point.name);
    } else {
      setPickup(point);
      setPickupText(point.name);
    }
    setLastAppliedTs(params.ts);
  }, [params.ts, params.field, params.lat, params.lng, params.address, lastAppliedTs]);

  useEffect(() => {
    const fetchEst = async () => {
      setEstimating(true);
      try {
        const data = await apiFetch('/deliveries/price-estimate', {
          method: 'POST',
          body: JSON.stringify({
            pickupAddress: pickup.name,
            pickupLat: pickup.lat,
            pickupLng: pickup.lng,
            dropoffAddress: dropoff.name,
            dropoffLat: dropoff.lat,
            dropoffLng: dropoff.lng,
            price: 0,
          }),
        });
        setEstimate(data);
      } catch (e: any) {
        console.log('estimate err', e);
      } finally {
        setEstimating(false);
      }
    };
    fetchEst();
  }, [pickup, dropoff, apiFetch]);

  const handleRequest = async () => {
    if (!estimate) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch('/deliveries/request', {
        method: 'POST',
        body: JSON.stringify({
          pickupAddress: pickup.name,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffAddress: dropoff.name,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          price: estimate.estimatedPrice,
          paymentMethod: payment,
        }),
      });
      const deliveryId = data.deliveryId;

      if (payment === 'CASH') {
        // Cash — skip payment, go straight to tracking
        router.replace(`/(customer)/tracking/${deliveryId}`);
        return;
      }

      // CARD / WALLET — initialize Paystack transaction, open WebView
      const init = await apiFetch('/payments/init', {
        method: 'POST',
        body: JSON.stringify({ deliveryId }),
      });
      router.replace({
        pathname: '/(customer)/payment',
        params: {
          deliveryId,
          reference: init.reference,
          authorizationUrl: init.authorizationUrl,
          isMock: init.isMock ? '1' : '0',
        },
      });
    } catch (e: any) {
      setError(e.message || 'Could not request delivery');
    } finally {
      setSubmitting(false);
    }
  };

  const openPicker = (field: 'pickup' | 'dropoff') => {
    const current = field === 'pickup' ? pickup : dropoff;
    router.push({
      pathname: '/(customer)/location-picker',
      params: { field, lat: String(current.lat), lng: String(current.lng), label: current.name },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="request-back-button">
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.asphaltBlack} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Request Delivery</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Route card */}
          <View style={styles.routeCard} testID="request-route-card">
            <View style={styles.routeIndicator}>
              <View style={[styles.dot, { backgroundColor: Colors.asphaltBlack }]} />
              <View style={styles.dashedLine} />
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            </View>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={styles.routeRow}
                onPress={() => openPicker('pickup')}
                testID="request-pickup-button"
              >
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{pickupText}</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.routeRow}
                onPress={() => openPicker('dropoff')}
                testID="request-dropoff-button"
              >
                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{dropoffText}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Estimate card */}
          <View style={styles.estimateCard} testID="request-estimate-card">
            <View style={styles.estimateHeader}>
              <Text style={styles.estimateHeaderTxt}>Delivery estimate</Text>
              {estimating ? <ActivityIndicator size="small" color={Colors.okadaOrange} /> : null}
            </View>
            <View style={styles.estimateRow}>
              <Stat icon="map-marker-distance" label="Distance" value={estimate ? `${estimate.distance} km` : '—'} />
              <Stat icon="clock-outline" label="ETA" value={estimate ? `${estimate.eta} min` : '—'} />
              <Stat icon="cash" label="Price" value={estimate ? `₦${estimate.estimatedPrice.toLocaleString()}` : '—'} highlight />
            </View>
          </View>

          {/* Payment method */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.payments}>
            {(['CASH', 'CARD', 'WALLET'] as PaymentMethod[]).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setPayment(m)}
                style={[styles.payItem, payment === m && styles.payItemActive]}
                testID={`payment-${m.toLowerCase()}`}
              >
                <MaterialCommunityIcons
                  name={m === 'CASH' ? 'cash' : m === 'CARD' ? 'credit-card-outline' : 'wallet-outline'}
                  size={20}
                  color={payment === m ? '#fff' : Colors.asphaltBlack}
                />
                <Text style={[styles.payTxt, payment === m && { color: '#fff' }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {payment !== 'CASH' && (
            <View style={styles.mockCard} testID="mock-payment-notice">
              <MaterialCommunityIcons name="information-outline" size={16} color={Colors.info} />
              <Text style={styles.mockCardTxt}>
                Secured by Paystack. You'll be charged ₦{estimate?.estimatedPrice?.toLocaleString() || '—'} upfront.
              </Text>
            </View>
          )}

          {error ? <Text style={styles.errorTxt} testID="request-error">{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title={submitting ? 'Finding rider…' : `Confirm • ₦${estimate?.estimatedPrice?.toLocaleString() || '—'}`}
            onPress={handleRequest}
            loading={submitting}
            disabled={!estimate}
            testID="request-confirm-button"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, highlight }: any) {
  return (
    <View style={{ flex: 1 }}>
      <View style={statStyles.head}>
        <MaterialCommunityIcons name={icon} size={14} color={Colors.textTertiary} />
        <Text style={statStyles.lbl}>{label}</Text>
      </View>
      <Text style={[statStyles.val, highlight && { color: Colors.okadaOrange, fontSize: 20 }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  lbl: { fontFamily: Fonts.bodyBold, fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', marginLeft: 4, letterSpacing: 0.6, fontWeight: '800' },
  val: { fontFamily: Fonts.headingBold, fontSize: 16, color: Colors.asphaltBlack, fontWeight: '800' },
});

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm,
  },
  topTitle: { fontFamily: Fonts.headingBold, fontSize: 18, fontWeight: '800', color: Colors.asphaltBlack, letterSpacing: -0.4 },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    ...Shadows.md,
    marginBottom: Spacing.md,
  },
  routeIndicator: {
    width: 24, alignItems: 'center', paddingTop: 20, marginRight: 8,
  },
  dot: {
    width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: '#fff',
  },
  dashedLine: {
    width: 2, flex: 1, backgroundColor: Colors.gray300, marginVertical: 4,
  },
  routeRow: { paddingVertical: 12 },
  routeLabel: { fontFamily: Fonts.bodyBold, fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '800' },
  routeValue: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.asphaltBlack, marginTop: 4, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.gray200 },
  estimateCard: {
    backgroundColor: Colors.asphaltBlack,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  estimateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  estimateHeaderTxt: {
    fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 12, opacity: 0.7,
    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '800',
  },
  estimateRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.md, borderRadius: Radii.md, gap: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, fontWeight: '800',
  },
  payments: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  payItem: {
    flex: 1, height: 56, borderRadius: Radii.lg,
    backgroundColor: Colors.gray50, borderWidth: 1.5, borderColor: Colors.gray200,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
  },
  payItemActive: { backgroundColor: Colors.asphaltBlack, borderColor: Colors.asphaltBlack },
  payTxt: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.asphaltBlack, marginLeft: 4, fontWeight: '700' },
  mockCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', borderRadius: Radii.md,
    padding: Spacing.sm, gap: 8, marginBottom: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.info,
  },
  mockCardTxt: { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginLeft: 4 },
  errorTxt: { fontFamily: Fonts.body, color: Colors.error, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.gray100,
    backgroundColor: Colors.surface,
  },
});
