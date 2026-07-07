import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Modal, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMap, MapMarker } from '@/src/components/AppMap';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

const STATUS_META: Record<string, { label: string; sub: string; color: string; icon: any }> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', sub: 'Complete checkout to dispatch a rider', color: Colors.warning, icon: 'credit-card-clock' },
  PENDING: { label: 'Finding rider…', sub: 'Notifying nearby okada riders', color: Colors.warning, icon: 'timer-sand' },
  NO_RIDERS_AVAILABLE: { label: 'No riders responded', sub: 'Try again — riders nearby may have changed', color: Colors.error, icon: 'account-alert' },
  ACCEPTED: { label: 'Rider is on the way', sub: 'To pickup location', color: Colors.info, icon: 'motorbike' },
  PICKED_UP: { label: 'Package picked up', sub: 'On the way to you', color: Colors.okadaOrange, icon: 'package-variant-closed-plus' },
  DELIVERED: { label: 'Delivered!', sub: 'Thanks for using WakaWaka', color: Colors.success, icon: 'check-circle' },
  CANCELLED: { label: 'Cancelled', sub: 'This delivery was cancelled', color: Colors.error, icon: 'close-circle' },
};

export default function Tracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { apiFetch } = useAuth();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [rating, setRating] = useState(5);
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchDelivery = useCallback(async () => {
    try {
      const data = await apiFetch(`/deliveries/${id}`);
      setDelivery(data.delivery);
      if (data.delivery.status === 'DELIVERED' && !data.delivery.rating) {
        setShowRate(true);
      }
    } catch (e: any) {
      console.log('fetch err', e);
    } finally {
      setLoading(false);
    }
  }, [id, apiFetch]);

  useEffect(() => {
    fetchDelivery();
    const iv = setInterval(fetchDelivery, 3000);
    return () => clearInterval(iv);
  }, [fetchDelivery]);

  const cancel = async () => {
    setCancelling(true);
    try {
      await apiFetch(`/deliveries/${id}/cancel`, { method: 'POST' });
      await fetchDelivery();
    } catch (e) {} finally {
      setCancelling(false);
    }
  };

  const submitRating = async () => {
    setSubmittingRating(true);
    try {
      await apiFetch(`/deliveries/${id}/rate`, { method: 'POST', body: JSON.stringify({ rating }) });
      setShowRate(false);
      await fetchDelivery();
    } catch (e) {} finally {
      setSubmittingRating(false);
    }
  };

  if (loading || !delivery) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.okadaOrange} />
      </View>
    );
  }

  const meta = STATUS_META[delivery.status] || STATUS_META.PENDING;
  const rider = delivery.rider;

  const markers: MapMarker[] = [
    { id: 'pickup', coord: { latitude: delivery.pickupLat, longitude: delivery.pickupLng }, label: `Pickup: ${delivery.pickupAddress}`, variant: 'pickup' },
    { id: 'dropoff', coord: { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng }, label: `Dropoff: ${delivery.dropoffAddress}`, variant: 'dropoff' },
  ];
  if (rider && rider.currentLat && rider.currentLng) {
    markers.push({ id: 'rider', coord: { latitude: rider.currentLat, longitude: rider.currentLng }, label: rider.name, variant: 'rider' });
  }

  const midLat = (delivery.pickupLat + delivery.dropoffLat) / 2;
  const midLng = (delivery.pickupLng + delivery.dropoffLng) / 2;
  const isDone = ['DELIVERED', 'CANCELLED', 'NO_RIDERS_AVAILABLE'].includes(delivery.status);

  return (
    <View style={styles.root} testID="tracking-screen">
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
        <TouchableOpacity onPress={() => router.replace('/(customer)/home')} style={styles.backBtn} testID="tracking-back-button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.asphaltBlack} />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
        <View style={styles.handle} />

        <View style={styles.statusRow}>
          <View style={[styles.statusIcon, { backgroundColor: meta.color }]}>
            <MaterialCommunityIcons name={meta.icon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.statusLabel} testID="tracking-status-label">{meta.label}</Text>
            <Text style={styles.statusSub}>{meta.sub}</Text>
          </View>
        </View>

        <View style={styles.progressBar} testID="tracking-progress">
          {['PENDING', 'ACCEPTED', 'PICKED_UP', 'DELIVERED'].map((s, i) => {
            const currentIdx = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'DELIVERED'].indexOf(delivery.status);
            const active = i <= currentIdx;
            return (
              <View key={s} style={[styles.progressStep, active && { backgroundColor: Colors.okadaOrange }]} />
            );
          })}
        </View>

        {rider && (
          <View style={styles.riderCard} testID="tracking-rider-card">
            <View style={styles.riderAvatar}>
              <MaterialCommunityIcons name="account" color="#fff" size={26} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.riderName}>{rider.name}</Text>
              <Text style={styles.riderMeta}>
                {rider.vehicleType} • {rider.licensePlate}
              </Text>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color={Colors.warning} />
                <Text style={styles.ratingTxt}>{rider.rating?.toFixed(1)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${rider.phone}`)}
              testID="tracking-call-rider"
            >
              <MaterialCommunityIcons name="phone" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.routeCard}>
          <View style={styles.routeIndicator}>
            <View style={[styles.dot, { backgroundColor: Colors.asphaltBlack }]} />
            <View style={styles.dashedLine} />
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLbl}>PICKUP</Text>
            <Text style={styles.routeVal} numberOfLines={1}>{delivery.pickupAddress}</Text>
            <View style={{ height: 12 }} />
            <Text style={styles.routeLbl}>DROPOFF</Text>
            <Text style={styles.routeVal} numberOfLines={1}>{delivery.dropoffAddress}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceTxt}>₦{Number(delivery.price).toLocaleString()}</Text>
          </View>
        </View>

        {!isDone && delivery.status !== 'PICKED_UP' && (
          <TouchableOpacity onPress={cancel} style={styles.cancelBtn} disabled={cancelling} testID="tracking-cancel-button">
            {cancelling ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <>
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={Colors.error} />
                <Text style={styles.cancelTxt}>Cancel delivery</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {isDone && (
          <PrimaryButton
            title="Back to home"
            variant="secondary"
            onPress={() => router.replace('/(customer)/home')}
            testID="tracking-done-button"
          />
        )}
      </View>

      {/* Rating modal */}
      <Modal visible={showRate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="rating-modal">
            <MaterialCommunityIcons name="motorbike" size={48} color={Colors.okadaOrange} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.modalTitle}>Rate your rider</Text>
            <Text style={styles.modalSub}>How was your delivery with {rider?.name || 'the rider'}?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`star-${n}`}>
                  <MaterialCommunityIcons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={Colors.warning}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <PrimaryButton
              title="Submit rating"
              onPress={submitRating}
              loading={submittingRating}
              testID="submit-rating-button"
            />
            <TouchableOpacity onPress={() => setShowRate(false)} style={{ marginTop: 8, alignSelf: 'center' }}>
              <Text style={{ fontFamily: Fonts.body, color: Colors.textSecondary }}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.md, paddingTop: 8 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xxl, borderTopRightRadius: Radii.xxl,
    paddingHorizontal: Spacing.lg, paddingTop: 12,
    ...Shadows.lg,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: Colors.gray200, alignSelf: 'center', marginBottom: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusIcon: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
  },
  statusLabel: { fontFamily: Fonts.headingBold, fontSize: 20, color: Colors.asphaltBlack, fontWeight: '800' },
  statusSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  progressBar: {
    flexDirection: 'row', gap: 4, marginBottom: Spacing.md,
  },
  progressStep: {
    flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.gray200,
  },
  riderCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radii.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray200,
  },
  riderAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.asphaltBlack, alignItems: 'center', justifyContent: 'center',
  },
  riderName: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.asphaltBlack, fontWeight: '800' },
  riderMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  ratingTxt: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.asphaltBlack, marginLeft: 3, fontWeight: '700' },
  callBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  routeCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray200, marginBottom: Spacing.md,
  },
  routeIndicator: { width: 20, alignItems: 'center', paddingTop: 18, marginRight: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  dashedLine: { width: 2, flex: 1, backgroundColor: Colors.gray300, marginVertical: 4 },
  routeLbl: { fontFamily: Fonts.bodyBold, fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.6, fontWeight: '800' },
  routeVal: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.asphaltBlack, marginTop: 2, fontWeight: '700' },
  priceTag: {
    backgroundColor: Colors.okadaOrange, borderRadius: Radii.md,
    paddingHorizontal: 12, alignSelf: 'flex-start', justifyContent: 'center', paddingVertical: 6,
  },
  priceTxt: { fontFamily: Fonts.headingBold, color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 12, gap: 8, borderRadius: Radii.lg,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
  },
  cancelTxt: { fontFamily: Fonts.bodyBold, color: Colors.error, fontWeight: '800', fontSize: 14, marginLeft: 6 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: Radii.xxl, padding: Spacing.lg, width: '100%',
  },
  modalTitle: { fontFamily: Fonts.headingBold, fontSize: 22, textAlign: 'center', color: Colors.asphaltBlack, fontWeight: '800' },
  modalSub: { fontFamily: Fonts.body, textAlign: 'center', color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.md },
});
