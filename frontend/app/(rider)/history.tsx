import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.info,
  PICKED_UP: Colors.okadaOrange,
  DELIVERED: Colors.success,
  CANCELLED: Colors.error,
};

export default function RiderHistory() {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/deliveries/history');
      setItems(data.deliveries || []);
    } catch {} finally { setLoading(false); }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <Text style={styles.subtitle}>{items.length} trips</Text>
      </View>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.okadaOrange} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="motorbike-off" size={72} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySub}>Go online to start receiving delivery requests.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.okadaOrange} />}
        >
          {items.map((d) => (
            <View key={d.id} style={styles.card} testID={`rider-history-item-${d.id}`}>
              <View style={styles.cardHead}>
                <View style={[styles.pill, { backgroundColor: `${STATUS_COLORS[d.status]}22`, borderColor: STATUS_COLORS[d.status] }]}>
                  <Text style={[styles.pillTxt, { color: STATUS_COLORS[d.status] }]}>{d.status}</Text>
                </View>
                <Text style={styles.price}>₦{Number(d.price).toLocaleString()}</Text>
              </View>
              <View style={styles.route}>
                <MaterialCommunityIcons name="package-variant" size={16} color={Colors.textTertiary} />
                <Text style={styles.routeTxt} numberOfLines={1}>
                  {d.pickupAddress} → {d.dropoffAddress}
                </Text>
              </View>
              <Text style={styles.date}>
                {new Date(d.createdAt).toLocaleString()} • Customer: {d.clientName}
              </Text>
            </View>
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
  emptySub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray200, ...Shadows.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.round, borderWidth: 1,
  },
  pillTxt: { fontFamily: Fonts.bodyBold, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  price: { fontFamily: Fonts.headingBold, fontSize: 18, color: Colors.asphaltBlack, fontWeight: '800' },
  route: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  routeTxt: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.asphaltBlack, marginLeft: 4, fontWeight: '700' },
  date: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
});
