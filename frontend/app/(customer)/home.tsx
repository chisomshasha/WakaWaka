import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMap, MapMarker } from '@/src/components/AppMap';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

// Default: Lagos - Victoria Island
const DEFAULT_REGION = { latitude: 6.4281, longitude: 3.4219, latitudeDelta: 0.03, longitudeDelta: 0.03 };

interface Rider {
  id: string;
  name: string;
  vehicleType: string;
  licensePlate: string;
  rating: number;
  distance: number;
  currentLat: number;
  currentLng: number;
}

interface ActiveDelivery {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  rider?: any;
}

export default function CustomerHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, apiFetch, logout } = useAuth();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>(null);

  const fetchNearby = useCallback(async () => {
    try {
      const data = await apiFetch(
        `/riders/nearby?lat=${DEFAULT_REGION.latitude}&lng=${DEFAULT_REGION.longitude}&radius=10`
      );
      setRiders(data.riders || []);
    } catch (e) {
      console.log('nearby err', e);
    }
  }, [apiFetch]);

  const fetchActive = useCallback(async () => {
    try {
      const data = await apiFetch('/deliveries/history');
      const active = (data.deliveries || []).find((d: any) =>
        ['PENDING', 'ACCEPTED', 'PICKED_UP'].includes(d.status)
      );
      setActiveDelivery(active || null);
    } catch (e) {
      console.log('active err', e);
    }
  }, [apiFetch]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        setLoading(true);
        await Promise.all([fetchNearby(), fetchActive()]);
        if (mounted) setLoading(false);
      };
      load();
      const interval = setInterval(() => {
        fetchNearby();
        fetchActive();
      }, 5000);
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, [fetchNearby, fetchActive])
  );

  const markers: MapMarker[] = riders.map((r) => ({
    id: r.id,
    coord: { latitude: r.currentLat, longitude: r.currentLng },
    label: `${r.name} • ${r.distance}km`,
    variant: 'rider',
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNearby(), fetchActive()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      {/* Map layer */}
      <View style={styles.mapWrap}>
        <AppMap
          region={DEFAULT_REGION}
          markers={markers}
          testID="customer-home-map"
        />
      </View>

      {/* Floating header */}
      <SafeAreaView edges={['top']} style={styles.headerWrap} pointerEvents="box-none">
        <View style={styles.header}>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(customer)/profile')} testID="customer-avatar-button">
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerHi}>Hello,</Text>
            <Text style={styles.headerName} numberOfLines={1}>{user?.name || 'Guest'}</Text>
          </View>
          <TouchableOpacity style={styles.notif} testID="customer-notif-button">
            <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.asphaltBlack} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.livePill} testID="customer-live-riders">
          <View style={styles.livePulse} />
          <Text style={styles.livePillText}>
            {loading ? 'Finding riders…' : `${riders.length} okada riders around you`}
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom sheet - request delivery */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
        <View style={styles.handle} />
        {activeDelivery ? (
          <TouchableOpacity
            testID="customer-active-delivery-card"
            style={styles.activeCard}
            onPress={() => router.push(`/(customer)/tracking/${activeDelivery.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.activePulseWrap}>
              <View style={styles.activePulse} />
              <MaterialCommunityIcons name="motorbike" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.activeTitle}>Active delivery</Text>
              <Text style={styles.activeSub} numberOfLines={1}>
                {activeDelivery.status === 'PENDING' ? 'Finding a rider…' : `${activeDelivery.rider?.name || 'Rider'} • ${activeDelivery.status}`}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color="#fff" />
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Where to send?</Text>
            <TouchableOpacity
              testID="customer-request-delivery-button"
              style={styles.searchInput}
              activeOpacity={0.85}
              onPress={() => router.push('/(customer)/request')}
            >
              <View style={styles.searchIcon}>
                <MaterialCommunityIcons name="map-marker" size={20} color={Colors.okadaOrange} />
              </View>
              <Text style={styles.searchTxt}>Enter delivery address</Text>
              <View style={styles.searchArrow}>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.quickRow}>
              <QuickAction icon="home-city" label="Home" testID="quick-home" />
              <QuickAction icon="briefcase" label="Work" testID="quick-work" />
              <QuickAction icon="food" label="Food" testID="quick-food" />
              <QuickAction icon="package-variant" label="Parcel" testID="quick-parcel" />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function QuickAction({ icon, label, testID }: { icon: any; label: string; testID: string }) {
  return (
    <TouchableOpacity style={styles.quickAction} testID={testID} activeOpacity={0.7}>
      <View style={styles.quickIcon}>
        <MaterialCommunityIcons name={icon} size={22} color={Colors.asphaltBlack} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.md, paddingTop: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.round,
    paddingHorizontal: 6, paddingRight: 12,
    height: 60,
    ...Shadows.md,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.asphaltBlack,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.headingBold, color: '#fff', fontSize: 18, fontWeight: '800',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerHi: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  headerName: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.asphaltBlack, fontWeight: '800' },
  notif: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.okadaOrange,
    borderWidth: 2, borderColor: Colors.surface,
  },
  livePill: {
    marginTop: 12, alignSelf: 'flex-start',
    backgroundColor: Colors.asphaltBlack,
    borderRadius: Radii.round,
    paddingVertical: 8, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center',
    ...Shadows.sm,
  },
  livePulse: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 8,
  },
  livePillText: {
    fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 12, fontWeight: '700',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    ...Shadows.lg,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: Colors.gray200,
    alignSelf: 'center', marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontFamily: Fonts.headingBold, fontSize: 22, fontWeight: '800',
    color: Colors.asphaltBlack, letterSpacing: -0.4, marginBottom: Spacing.md,
  },
  searchInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: Radii.lg,
    height: 60, paddingLeft: 8, paddingRight: 6,
    borderWidth: 1.5, borderColor: Colors.gray200,
  },
  searchIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,79,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchTxt: {
    flex: 1, marginLeft: 12,
    fontFamily: Fonts.body, fontSize: 15, color: Colors.textSecondary, fontWeight: '600',
  },
  searchArrow: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.okadaOrange,
    alignItems: 'center', justifyContent: 'center',
  },
  quickRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg,
  },
  quickAction: {
    alignItems: 'center', flex: 1,
  },
  quickIcon: {
    width: 56, height: 56, borderRadius: 20,
    backgroundColor: Colors.gray50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.gray200,
  },
  quickLabel: {
    fontFamily: Fonts.bodyBold, fontSize: 11, marginTop: 6, color: Colors.textSecondary, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  activeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.okadaOrange,
    borderRadius: Radii.lg,
    padding: Spacing.md,
  },
  activePulseWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  activePulse: {
    position: 'absolute', width: '100%', height: '100%', borderRadius: 26,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  activeTitle: {
    fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '800',
  },
  activeSub: {
    fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2,
  },
});
