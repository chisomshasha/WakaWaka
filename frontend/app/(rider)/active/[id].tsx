import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMap, MapMarker } from '@/src/components/AppMap';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

export default function RiderActive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { apiFetch } = useAuth();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchIt = useCallback(async () => {
    try {
      const data = await apiFetch(`/deliveries/${id}`);
      setDelivery(data.delivery);
    } catch {} finally { setLoading(false); }
  }, [id, apiFetch]);

  useEffect(() => { fetchIt(); }, [fetchIt]);

  const advance = async (status: 'PICKED_UP' | 'DELIVERED') => {
    setUpdating(true);
    try {
      await apiFetch(`/deliveries/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await fetchIt();
      if (status === 'DELIVERED') {
        setTimeout(() => router.replace('/(rider)/home'), 1500);
      }
    } catch {} finally { setUpdating(false); }
  };

  if (loading || !delivery) {
    return <View style={styles.loading}><ActivityIndicator color={Colors.okadaOrange} size="large" /></View>;
  }

  const midLat = (delivery.pickupLat + delivery.dropoffLat) / 2;
  const midLng = (delivery.pickupLng + delivery.dropoffLng) / 2;
  const markers: MapMarker[] = [
    { id: 'pickup', coord: { latitude: delivery.pickupLat, longitude: delivery.pickupLng }, variant: 'pickup', label: 'Pickup' },
    { id: 'dropoff', coord: { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng }, variant: 'dropoff', label: 'Dropoff' },
  ];

  const nextStep = delivery.status === 'ACCEPTED' ? 'PICKED_UP' : delivery.status === 'PICKED_UP' ? 'DELIVERED' : null;
  const nextLabel = nextStep === 'PICKED_UP' ? "I've picked up" : nextStep === 'DELIVERED' ? 'Complete delivery' : 'Delivered';

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <AppMap
          region={{ latitude: midLat, longitude: midLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          markers={markers}
          route={[
            { latitude: delivery.pickupLat, longitude: delivery.pickupLng },
            { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng },
          ]}
        />
      </View>

      <SafeAreaView edges={['top']} style={styles.topWrap} pointerEvents="box-none">
        <TouchableOpacity onPress={() => router.replace('/(rider)/home')} style={styles.backBtn} testID="rider-active-back">
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.asphaltBlack} />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.stepLabel}>
              {delivery.status === 'ACCEPTED' ? 'PICKUP FROM' :
               delivery.status === 'PICKED_UP' ? 'DROP OFF AT' :
               'DELIVERED'}
            </Text>
            <Text style={styles.stepAddr} numberOfLines={2}>
              {delivery.status === 'ACCEPTED' ? delivery.pickupAddress :
               delivery.status === 'PICKED_UP' ? delivery.dropoffAddress :
               'Trip complete'}
            </Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceTxt}>₦{Number(delivery.riderEarning || delivery.price).toLocaleString()}</Text>
            {delivery.platformFee ? (
              <Text style={styles.priceTagSub}>Your take-home (after 15%)</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.customerCard}>
          <View style={styles.customerAvatar}>
            <MaterialCommunityIcons name="account" color="#fff" size={24} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.customerName}>{delivery.clientName}</Text>
            <Text style={styles.customerMeta}>Customer</Text>
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${delivery.clientPhone}`)}
            testID="rider-call-customer"
          >
            <MaterialCommunityIcons name="phone" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.progressBar}>
          {['ACCEPTED', 'PICKED_UP', 'DELIVERED'].map((s, i) => {
            const idx = ['ACCEPTED', 'PICKED_UP', 'DELIVERED'].indexOf(delivery.status);
            const active = i <= idx;
            return <View key={s} style={[styles.progressStep, active && { backgroundColor: Colors.okadaOrange }]} />;
          })}
        </View>

        {nextStep ? (
          <PrimaryButton
            title={nextLabel}
            onPress={() => advance(nextStep)}
            loading={updating}
            testID="rider-advance-button"
          />
        ) : (
          <PrimaryButton
            title="Back to home"
            variant="secondary"
            onPress={() => router.replace('/(rider)/home')}
            testID="rider-active-done"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, padding: Spacing.md },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xxl, borderTopRightRadius: Radii.xxl,
    padding: Spacing.lg, paddingTop: Spacing.md,
    ...Shadows.lg,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.gray200,
    alignSelf: 'center', marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md, gap: 12,
  },
  stepLabel: {
    fontFamily: Fonts.bodyBold, fontSize: 11, color: Colors.okadaOrange,
    letterSpacing: 1.2, fontWeight: '800',
  },
  stepAddr: { fontFamily: Fonts.headingBold, fontSize: 20, color: Colors.asphaltBlack, marginTop: 4, fontWeight: '800' },
  priceTag: {
    backgroundColor: Colors.asphaltBlack, borderRadius: Radii.md,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-end',
  },
  priceTxt: { fontFamily: Fonts.headingBold, color: '#fff', fontWeight: '800', fontSize: 16 },
  priceTagSub: { fontFamily: Fonts.body, color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 2, fontWeight: '600' },
  customerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radii.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray200,
  },
  customerAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.asphaltBlack,
    alignItems: 'center', justifyContent: 'center',
  },
  customerName: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.asphaltBlack, fontWeight: '800' },
  customerMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  callBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  progressBar: { flexDirection: 'row', gap: 4, marginBottom: Spacing.md },
  progressStep: { flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.gray200 },
});
