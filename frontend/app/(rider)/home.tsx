import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMap, MapMarker } from '@/src/components/AppMap';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useAuth } from '@/src/context/auth';
import { useRiderLocationTracker } from '@/src/hooks/useRiderLocationTracker';
import { useIncomingRequestAlert } from '@/src/hooks/useIncomingRequestAlert';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

// Rider default location: Lagos
const RIDER_LOCATION = { latitude: 6.4281, longitude: 3.4219, latitudeDelta: 0.03, longitudeDelta: 0.03 };

export default function RiderHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, apiFetch, refreshUser } = useAuth();
  const [online, setOnline] = useState(user?.rider?.isOnline || false);
  const [stats, setStats] = useState<any>(null);
  const [toggling, setToggling] = useState(false);
  const [incoming, setIncoming] = useState<any | null>(null);
  const [accepting, setAccepting] = useState(false);
  const timerAnim = useRef(new Animated.Value(1)).current;

  // Send our GPS to the backend every ~5s while online.
  // If we have an active delivery, drift toward pickup (ACCEPTED) or dropoff (PICKED_UP).
  const active = stats?.currentDelivery;
  const target = active
    ? active.status === 'PICKED_UP'
      ? { lat: active.dropoffLat, lng: active.dropoffLng }
      : { lat: active.pickupLat, lng: active.pickupLng }
    : null;
  useRiderLocationTracker({
    enabled: online,
    initialLat: RIDER_LOCATION.latitude,
    initialLng: RIDER_LOCATION.longitude,
    apiFetch,
    target,
  });

  // Ring + vibrate while a request is on screen, stop on accept/decline/timeout.
  useIncomingRequestAlert(!!incoming);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch('/riders/stats');
      setStats(data.stats);
      setOnline(data.stats?.isOnline || false);
    } catch (e) {}
  }, [apiFetch]);

  const pollIncoming = useCallback(async () => {
    if (!online) return;
    try {
      const data = await apiFetch('/riders/incoming');
      if (data.requests && data.requests.length > 0 && !incoming) {
        setIncoming(data.requests[0]);
      }
    } catch (e) {}
  }, [apiFetch, online, incoming]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      const iv = setInterval(() => {
        fetchStats();
        pollIncoming();
      }, 3000);
      return () => clearInterval(iv);
    }, [fetchStats, pollIncoming])
  );

  // Animate countdown when incoming exists
  useEffect(() => {
    if (incoming) {
      timerAnim.setValue(1);
      const remaining = incoming.secondsRemaining || 60;
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: remaining * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setIncoming(null);
      });
    }
  }, [incoming, timerAnim]);

  const toggleOnline = async () => {
    setToggling(true);
    try {
      if (online) {
        await apiFetch('/riders/offline', { method: 'POST' });
      } else {
        await apiFetch('/riders/online', {
          method: 'POST',
          body: JSON.stringify({ lat: RIDER_LOCATION.latitude, lng: RIDER_LOCATION.longitude }),
        });
      }
      await fetchStats();
      await refreshUser();
    } catch (e) {}
    finally { setToggling(false); }
  };

  const acceptDelivery = async () => {
    if (!incoming) return;
    setAccepting(true);
    try {
      const res = await apiFetch('/riders/accept', {
        method: 'POST',
        body: JSON.stringify({ deliveryId: incoming.id }),
      });
      setIncoming(null);
      router.push(`/(rider)/active/${res.delivery.id}`);
    } catch (e: any) {
      setIncoming(null);
    } finally {
      setAccepting(false);
    }
  };

  const declineDelivery = async () => {
    if (!incoming) return;
    try {
      await apiFetch('/riders/decline', {
        method: 'POST',
        body: JSON.stringify({ deliveryId: incoming.id }),
      });
    } catch {}
    setIncoming(null);
  };

  const timerWidth = timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const markers: MapMarker[] = [
    { id: 'me', coord: { latitude: RIDER_LOCATION.latitude, longitude: RIDER_LOCATION.longitude }, variant: 'rider', label: 'You' },
  ];

  const activeDelivery = stats?.currentDelivery;

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <AppMap region={RIDER_LOCATION} markers={markers} testID="rider-home-map" />
      </View>

      {/* Top Status Bar */}
      <SafeAreaView edges={['top']} style={styles.topWrap} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.riderName}>{user?.name}</Text>
            <View style={styles.riderStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: online ? Colors.success : Colors.gray400 }]} />
              <Text style={styles.riderStatus}>{online ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <View style={styles.earningsPill}>
            <MaterialCommunityIcons name="cash" size={16} color={Colors.okadaOrange} />
            <Text style={styles.earningsPillTxt}>₦{stats?.todayEarnings?.toLocaleString() || '0'}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Active Delivery Banner */}
      {activeDelivery && (
        <TouchableOpacity
          style={[styles.activeBanner, { top: insets.top + 82 }]}
          onPress={() => router.push(`/(rider)/active/${activeDelivery.id}`)}
          testID="rider-active-banner"
        >
          <MaterialCommunityIcons name="motorbike" size={20} color="#fff" />
          <Text style={styles.activeBannerTxt}>
            Active delivery • {activeDelivery.status}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bottom Sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
        <View style={styles.statsRow}>
          <StatBlock label="Today" value={stats?.todayDeliveries || 0} suffix="trips" />
          <View style={styles.statDivider} />
          <StatBlock label="Rating" value={stats?.rating?.toFixed(1) || '5.0'} icon="star" />
          <View style={styles.statDivider} />
          <StatBlock label="Total" value={stats?.totalDeliveries || 0} suffix="all" />
        </View>

        <TouchableOpacity
          style={[
            styles.goBtn,
            { backgroundColor: online ? Colors.error : Colors.okadaOrange },
          ]}
          onPress={toggleOnline}
          disabled={toggling}
          activeOpacity={0.9}
          testID="rider-online-toggle"
        >
          <View style={styles.goPulse}>
            <MaterialCommunityIcons name={online ? 'stop-circle' : 'motorbike'} size={28} color="#fff" />
          </View>
          <Text style={styles.goTxt}>{online ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {online ? 'You are receiving requests. Ride safe!' : 'Tap Go Online to start receiving delivery requests.'}
        </Text>
      </View>

      {/* Incoming Request Modal */}
      <Modal visible={!!incoming} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.incomingCard} testID="incoming-request-modal">
            <View style={styles.timerTrack}>
              <Animated.View style={[styles.timerBar, { width: timerWidth }]} />
            </View>
            <Text style={styles.incomingTitle}>NEW DELIVERY REQUEST</Text>
            <Text style={styles.incomingPrice}>
              ₦{Number(incoming?.riderEarning ?? incoming?.price ?? 0).toLocaleString()}
            </Text>
            {incoming?.platformFee ? (
              <Text style={styles.incomingPriceSub}>
                Take-home (after 15% fee)
              </Text>
            ) : null}
            <View style={styles.incomingMeta}>
              <View style={styles.metaChip}>
                <MaterialCommunityIcons name="map-marker-distance" size={14} color="#fff" />
                <Text style={styles.metaChipTxt}>{incoming?.distanceToPickup?.toFixed(1) || '—'} km</Text>
              </View>
              <View style={styles.metaChip}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#fff" />
                <Text style={styles.metaChipTxt}>{incoming?.duration || '—'} min</Text>
              </View>
            </View>

            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: Colors.asphaltBlack }]} />
                <Text style={styles.routeAddr} numberOfLines={1}>{incoming?.pickupAddress}</Text>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.routeAddr} numberOfLines={1}>{incoming?.dropoffAddress}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={declineDelivery} style={styles.declineBtn} testID="decline-request-button">
                <Text style={styles.declineTxt}>Decline</Text>
              </TouchableOpacity>
              <PrimaryButton
                title={accepting ? '' : 'ACCEPT'}
                onPress={acceptDelivery}
                loading={accepting}
                style={{ flex: 1 }}
                testID="accept-request-button"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatBlock({ label, value, suffix, icon }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon ? <MaterialCommunityIcons name={icon} size={14} color={Colors.warning} /> : null}
        <Text style={statStyles.val}>{value}</Text>
      </View>
      <Text style={statStyles.lbl}>{label}{suffix ? ` ${suffix}` : ''}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  val: { fontFamily: Fonts.headingBold, fontSize: 20, color: Colors.asphaltBlack, fontWeight: '800' },
  lbl: { fontFamily: Fonts.bodyBold, fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2, fontWeight: '800' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, padding: Spacing.md },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.round,
    padding: 8, paddingRight: 12, height: 60, ...Shadows.md,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.okadaOrange, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: Fonts.headingBold, color: '#fff', fontSize: 18, fontWeight: '800' },
  riderName: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.asphaltBlack, fontWeight: '800' },
  riderStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  riderStatus: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginLeft: 4 },
  earningsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,79,0,0.12)', paddingHorizontal: 12, height: 36, borderRadius: Radii.round,
  },
  earningsPillTxt: { fontFamily: Fonts.bodyBold, color: Colors.okadaOrange, fontWeight: '800', fontSize: 13, marginLeft: 4 },
  activeBanner: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.okadaOrange, borderRadius: Radii.lg,
    paddingVertical: 12, paddingHorizontal: 14,
    ...Shadows.md,
  },
  activeBannerTxt: { flex: 1, fontFamily: Fonts.bodyBold, color: '#fff', fontWeight: '800', fontSize: 14, marginLeft: 8 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xxl, borderTopRightRadius: Radii.xxl,
    padding: Spacing.lg, paddingTop: Spacing.md,
    ...Shadows.lg,
  },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.gray50,
    borderRadius: Radii.lg, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  statDivider: { width: 1, backgroundColor: Colors.gray200, marginHorizontal: 8 },
  goBtn: {
    height: 68, borderRadius: Radii.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    ...Shadows.md,
  },
  goPulse: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  goTxt: {
    fontFamily: Fonts.headingBold, color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1.2, marginLeft: 8,
  },
  hint: {
    textAlign: 'center', fontFamily: Fonts.body, color: Colors.textSecondary, fontSize: 12, marginTop: 10,
  },
  // Incoming
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  incomingCard: {
    backgroundColor: Colors.asphaltBlack, padding: Spacing.lg,
    borderTopLeftRadius: Radii.xxl, borderTopRightRadius: Radii.xxl,
  },
  timerTrack: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginBottom: 16, overflow: 'hidden',
  },
  timerBar: { height: '100%', backgroundColor: Colors.okadaOrange },
  incomingTitle: {
    fontFamily: Fonts.bodyBold, color: Colors.okadaOrange, textAlign: 'center',
    fontSize: 12, letterSpacing: 1.5, fontWeight: '800',
  },
  incomingPrice: {
    fontFamily: Fonts.headingBold, color: '#fff', textAlign: 'center',
    fontSize: 52, fontWeight: '800', letterSpacing: -1, marginTop: 6,
  },
  incomingPriceSub: {
    fontFamily: Fonts.body, color: 'rgba(255,255,255,0.5)', textAlign: 'center',
    fontSize: 11, fontWeight: '600', marginTop: -2,
  },
  incomingMeta: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 6, marginBottom: 20,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.round,
  },
  metaChipTxt: { fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  routeBox: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radii.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeAddr: { flex: 1, fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  routeDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8, marginLeft: 18 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  declineBtn: {
    flex: 1, height: 56, borderRadius: Radii.lg,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  declineTxt: { fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 16, fontWeight: '700' },
});
