import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

type Period = 'day' | 'week' | 'month';

export default function RiderEarnings() {
  const { apiFetch } = useAuth();
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/riders/earnings?period=${period}`);
      setData(res);
    } catch {} finally { setLoading(false); }
  }, [period, apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.asphaltBlack }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.subtitle}>Track your money moves</Text>
        </View>

        <View style={styles.periodRow}>
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              testID={`earnings-period-${p}`}
            >
              <Text style={[styles.periodTxt, period === p && styles.periodTxtActive]}>
                {p === 'day' ? 'Today' : p === 'week' ? 'This week' : 'This month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainCard} testID="earnings-main-card">
          <Text style={styles.mainLbl}>Total earned</Text>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.okadaOrange} style={{ marginTop: 20 }} />
          ) : (
            <>
              <Text style={styles.mainVal}>₦{Number(data?.totalEarnings || 0).toLocaleString()}</Text>
              <View style={styles.mainMeta}>
                <View style={styles.mainMetaChip}>
                  <MaterialCommunityIcons name="package-check" size={14} color={Colors.okadaOrange} />
                  <Text style={styles.mainMetaTxt}>{data?.count || 0} trips</Text>
                </View>
                <View style={styles.mainMetaChip}>
                  <MaterialCommunityIcons name="trending-up" size={14} color={Colors.okadaOrange} />
                  <Text style={styles.mainMetaTxt}>Avg ₦{Number(data?.averageEarnings || 0).toLocaleString()}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Recent trips</Text>
        {data?.deliveries?.length ? (
          data.deliveries.map((d: any) => (
            <View key={d.id} style={styles.tripCard} testID={`earnings-trip-${d.id}`}>
              <View style={styles.tripIcon}>
                <MaterialCommunityIcons name="motorbike" color={Colors.okadaOrange} size={20} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.tripAddr} numberOfLines={1}>{d.pickupAddress} → {d.dropoffAddress}</Text>
                <Text style={styles.tripMeta}>
                  {new Date(d.deliveredAt).toLocaleDateString()} • {d.distance?.toFixed(1) || '—'} km
                </Text>
              </View>
              <Text style={styles.tripPrice}>+₦{Number(d.price).toLocaleString()}</Text>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="cash-lock" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyTxt}>No trips completed in this period</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  title: { fontFamily: Fonts.headingBold, fontSize: 28, color: '#fff', fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: Spacing.md, borderRadius: Radii.round, padding: 4,
  },
  periodBtn: { flex: 1, height: 40, borderRadius: Radii.round, alignItems: 'center', justifyContent: 'center' },
  periodBtnActive: { backgroundColor: Colors.okadaOrange },
  periodTxt: { fontFamily: Fonts.bodyBold, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' },
  periodTxtActive: { color: '#fff' },
  mainCard: {
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    backgroundColor: 'rgba(255,79,0,0.12)',
    borderRadius: Radii.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,79,0,0.3)',
  },
  mainLbl: { fontFamily: Fonts.bodyBold, color: Colors.okadaOrange, fontSize: 11, letterSpacing: 1.2, fontWeight: '800' },
  mainVal: { fontFamily: Fonts.headingBold, color: '#fff', fontSize: 48, fontWeight: '800', letterSpacing: -1.5, marginTop: 4 },
  mainMeta: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mainMetaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.round,
  },
  mainMetaTxt: { fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  sectionTitle: {
    fontFamily: Fonts.bodyBold, color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2, fontSize: 11, fontWeight: '800',
    paddingHorizontal: Spacing.md, marginTop: Spacing.lg, marginBottom: 8,
    textTransform: 'uppercase',
  },
  tripCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radii.lg, padding: Spacing.md,
    marginHorizontal: Spacing.md, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tripIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,79,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  tripAddr: { fontFamily: Fonts.bodyBold, color: '#fff', fontSize: 14, fontWeight: '700' },
  tripMeta: { fontFamily: Fonts.body, color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  tripPrice: { fontFamily: Fonts.headingBold, color: Colors.success, fontSize: 15, fontWeight: '800' },
  empty: { alignItems: 'center', padding: Spacing.xl, marginTop: Spacing.md },
  emptyTxt: { fontFamily: Fonts.body, color: 'rgba(255,255,255,0.4)', marginTop: 12 },
});
