import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.info,
  PICKED_UP: Colors.okadaOrange,
  DELIVERED: Colors.success,
  CANCELLED: Colors.error,
  NO_RIDERS_AVAILABLE: Colors.error,
};

export default function CustomerHistory() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/deliveries/history');
      setItems(data.deliveries || []);
    } catch (e) {}
    finally { setLoading(false); }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Deliveries</Text>
        <Text style={styles.subtitle}>{items.length} total</Text>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.okadaOrange} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty} testID="history-empty">
          <MaterialCommunityIcons name="package-variant" size={80} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No deliveries yet</Text>
          <Text style={styles.emptySub}>Your delivery history will appear here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(customer)/request')} testID="history-empty-cta">
            <Text style={styles.emptyBtnTxt}>Send a package</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.okadaOrange} />}
        >
          {items.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={styles.card}
              activeOpacity={0.85}
              testID={`history-item-${d.id}`}
              onPress={() => router.push(`/(customer)/tracking/${d.id}`)}
            >
              <View style={styles.cardHead}>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[d.status]}22`, borderColor: STATUS_COLORS[d.status] }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[d.status] }]} />
                  <Text style={[styles.statusTxt, { color: STATUS_COLORS[d.status] }]}>{d.status}</Text>
                </View>
                <Text style={styles.price}>₦{Number(d.price).toLocaleString()}</Text>
              </View>
              <View style={styles.route}>
                <View style={styles.indicator}>
                  <View style={[styles.dot, { backgroundColor: Colors.asphaltBlack }]} />
                  <View style={styles.dashLine} />
                  <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowVal} numberOfLines={1}>{d.pickupAddress}</Text>
                  <View style={{ height: 8 }} />
                  <Text style={styles.rowVal} numberOfLines={1}>{d.dropoffAddress}</Text>
                </View>
              </View>
              <View style={styles.cardFoot}>
                <Text style={styles.cardMeta}>
                  {new Date(d.createdAt).toLocaleDateString()} • {d.distance?.toFixed(1) || '—'} km
                </Text>
                {d.rider ? (
                  <Text style={styles.cardMeta}>Rider: {d.rider.name}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  title: { fontFamily: Fonts.headingBold, fontSize: 28, color: Colors.asphaltBlack, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTitle: { fontFamily: Fonts.headingBold, fontSize: 20, marginTop: 12, color: Colors.asphaltBlack, fontWeight: '800' },
  emptySub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.okadaOrange, paddingHorizontal: 24, paddingVertical: 14, borderRadius: Radii.round },
  emptyBtnTxt: { fontFamily: Fonts.bodyBold, color: '#fff', fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray200, ...Shadows.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radii.round, borderWidth: 1, gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontFamily: Fonts.bodyBold, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 4 },
  price: { fontFamily: Fonts.headingBold, fontSize: 18, color: Colors.asphaltBlack, fontWeight: '800' },
  route: { flexDirection: 'row', marginBottom: 12 },
  indicator: { width: 20, alignItems: 'center', paddingTop: 6, marginRight: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  dashLine: { width: 2, flex: 1, backgroundColor: Colors.gray300, marginVertical: 2 },
  rowVal: { fontFamily: Fonts.body, fontSize: 14, color: Colors.asphaltBlack, fontWeight: '600' },
  cardFoot: {
    borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 10,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  cardMeta: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
});
