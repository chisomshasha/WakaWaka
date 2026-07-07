import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

export default function CustomerProfile() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileHead}>
          <View style={styles.avatar} testID="profile-avatar">
            <Text style={styles.avatarTxt}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="package-variant-closed" size={12} color={Colors.okadaOrange} />
            <Text style={styles.badgeTxt}>Customer</Text>
          </View>
        </View>

        <View style={styles.section}>
          <MenuItem icon="map-marker-multiple" title="Saved addresses" testID="menu-addresses" />
          <MenuItem icon="credit-card-outline" title="Payment methods" testID="menu-payments" />
          <MenuItem icon="bell-outline" title="Notifications" testID="menu-notifications" />
          <MenuItem icon="shield-check-outline" title="Safety" testID="menu-safety" />
          <MenuItem icon="help-circle-outline" title="Help center" testID="menu-help" />
          <MenuItem icon="information-outline" title="About WakaWaka" testID="menu-about" />
        </View>

        <PrimaryButton
          title="Log out"
          onPress={logout}
          variant="outline"
          testID="logout-button"
          style={{ marginTop: Spacing.md }}
        />

        <Text style={styles.footer}>WakaWaka v1.0 • Made in Lagos</Text>
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
    backgroundColor: Colors.asphaltBlack, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
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
  section: {
    backgroundColor: Colors.surface, borderRadius: Radii.lg, marginTop: Spacing.md,
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
  footer: { textAlign: 'center', color: Colors.textTertiary, fontSize: 12, marginTop: Spacing.lg, fontFamily: Fonts.body },
});
