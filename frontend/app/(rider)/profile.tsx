import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Colors, Fonts, Radii, Spacing } from '@/src/theme';

export default function RiderProfile() {
  const { user, logout } = useAuth();
  const rider = user?.rider;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{user?.name?.[0]?.toUpperCase() || 'R'}</Text>
          </View>
          <Text style={styles.name} testID="rider-profile-name">{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="motorbike" size={12} color={Colors.okadaOrange} />
            <Text style={styles.badgeTxt}>WakaWaka Rider</Text>
          </View>

          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={20} color={Colors.warning} />
            <Text style={styles.ratingTxt}>{rider?.rating?.toFixed(1) || '5.0'}</Text>
            <Text style={styles.ratingSub}>• {rider?.totalDeliveries || 0} deliveries</Text>
          </View>
        </View>

        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons name="motorbike" size={28} color={Colors.okadaOrange} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.vehicleLbl}>Your bike</Text>
            <Text style={styles.vehicleName}>{rider?.vehicleType || 'Motorcycle'}</Text>
            <Text style={styles.vehiclePlate}>{rider?.licensePlate || 'LAG-000-XX'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <MenuItem icon="bank" title="Payout method" testID="menu-payout" />
          <MenuItem icon="shield-check-outline" title="Insurance & Safety" testID="menu-safety" />
          <MenuItem icon="file-document-outline" title="Documents" testID="menu-docs" />
          <MenuItem icon="help-circle-outline" title="Rider support" testID="menu-support" />
          <MenuItem icon="information-outline" title="About WakaWaka" testID="menu-about" />
        </View>

        <PrimaryButton
          title="Log out"
          onPress={logout}
          variant="outline"
          testID="rider-logout-button"
          style={{ marginTop: Spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, title, testID }: { icon: any; title: string; testID: string }) {
  return (
    <TouchableOpacity style={styles.menuItem} testID={testID} activeOpacity={0.7}>
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.asphaltBlack} />
      </View>
      <Text style={styles.menuTitle}>{title}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.gray400} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  profileHead: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: Colors.okadaOrange, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarTxt: { fontFamily: Fonts.headingBold, color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { fontFamily: Fonts.headingBold, fontSize: 22, color: Colors.asphaltBlack, fontWeight: '800' },
  phone: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radii.round, backgroundColor: 'rgba(255,79,0,0.12)',
  },
  badgeTxt: { fontFamily: Fonts.bodyBold, fontSize: 11, color: Colors.okadaOrange, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 4 },
  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12,
  },
  ratingTxt: { fontFamily: Fonts.headingBold, fontSize: 20, color: Colors.asphaltBlack, marginLeft: 4, fontWeight: '800' },
  ratingSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginLeft: 6 },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.asphaltBlack, borderRadius: Radii.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  vehicleIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,79,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleLbl: { fontFamily: Fonts.body, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  vehicleName: { fontFamily: Fonts.headingBold, color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  vehiclePlate: { fontFamily: Fonts.body, color: Colors.okadaOrange, fontSize: 12, marginTop: 2, fontWeight: '700', letterSpacing: 0.8 },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.gray200, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray50,
    alignItems: 'center', justifyContent: 'center',
  },
  menuTitle: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.asphaltBlack, marginLeft: 8, fontWeight: '700' },
});
