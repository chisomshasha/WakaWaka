import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radii, Spacing } from '@/src/theme';

const CUSTOMER_IMG = 'https://images.pexels.com/photos/4440774/pexels-photo-4440774.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const RIDER_IMG = 'https://images.pexels.com/photos/26760670/pexels-photo-26760670.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

export default function RoleSelection() {
  const router = useRouter();

  const chooseRole = (role: 'CLIENT' | 'RIDER') => {
    router.push({ pathname: '/(auth)/login', params: { role } });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot}>
            <MaterialCommunityIcons name="motorbike" color="#fff" size={22} />
          </View>
          <View>
            <Text style={styles.brand}>WakaWaka</Text>
            <Text style={styles.tagline}>Fast bike delivery, no wahala</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <Text style={styles.title} testID="role-title">How you dey use{'\n'}WakaWaka today?</Text>
        <Text style={styles.subtitle}>Pick your side. You can always switch later.</Text>

        <TouchableOpacity
          testID="role-customer-button"
          activeOpacity={0.9}
          onPress={() => chooseRole('CLIENT')}
          style={styles.card}
        >
          <ImageBackground source={{ uri: CUSTOMER_IMG }} style={styles.cardImage} imageStyle={styles.cardImageStyle}>
            <View style={styles.cardOverlay} />
            <View style={styles.cardContent}>
              <View style={styles.cardBadge}>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color={Colors.asphaltBlack} />
                <Text style={styles.cardBadgeText}>Customer</Text>
              </View>
              <Text style={styles.cardTitle}>I need a delivery</Text>
              <Text style={styles.cardSubtitle}>Send packages across town in minutes.</Text>
              <View style={styles.cardCta}>
                <Text style={styles.cardCtaText}>Continue</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        <TouchableOpacity
          testID="role-rider-button"
          activeOpacity={0.9}
          onPress={() => chooseRole('RIDER')}
          style={[styles.card, styles.riderCard]}
        >
          <View style={styles.riderInner}>
            <Image source={{ uri: RIDER_IMG }} style={styles.riderImg} />
            <View style={styles.riderContent}>
              <View style={[styles.cardBadge, styles.riderBadge]}>
                <MaterialCommunityIcons name="motorbike" size={18} color={Colors.okadaOrange} />
                <Text style={[styles.cardBadgeText, { color: Colors.okadaOrange }]}>Rider</Text>
              </View>
              <Text style={[styles.cardTitle, { color: '#fff' }]}>I am a Rider</Text>
              <Text style={[styles.cardSubtitle, { color: '#D1D5DB' }]}>Earn on your schedule.</Text>
              <View style={[styles.cardCta, { backgroundColor: Colors.okadaOrange }]}>
                <Text style={styles.cardCtaText}>Continue</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandDot: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.okadaOrange,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  brand: {
    fontFamily: Fonts.headingBold,
    fontSize: 22, fontWeight: '800', color: Colors.asphaltBlack, letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 32, fontWeight: '800', color: Colors.asphaltBlack,
    lineHeight: 38, marginBottom: 8, letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 15, color: Colors.textSecondary, marginBottom: Spacing.lg,
  },
  card: {
    borderRadius: Radii.xxl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    height: 210,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    backgroundColor: Colors.surface,
  },
  cardImage: { flex: 1, justifyContent: 'flex-end' },
  cardImageStyle: { borderRadius: Radii.xxl },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  cardContent: {
    padding: Spacing.lg,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radii.round,
    marginBottom: 10,
    gap: 6,
  },
  cardBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12, fontWeight: '800',
    color: Colors.asphaltBlack,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  cardTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 26, fontWeight: '800',
    color: Colors.asphaltBlack, letterSpacing: -0.6,
  },
  cardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13, color: Colors.textSecondary,
    marginTop: 4, marginBottom: 12,
  },
  cardCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.asphaltBlack,
    height: 44, borderRadius: Radii.round,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    gap: 8,
  },
  cardCtaText: {
    fontFamily: Fonts.bodyBold,
    color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.3, marginRight: 6,
  },
  riderCard: {
    backgroundColor: Colors.asphaltBlack,
  },
  riderInner: {
    flex: 1, flexDirection: 'row', overflow: 'hidden',
  },
  riderImg: {
    width: 130, height: '100%',
  },
  riderContent: {
    flex: 1, padding: Spacing.lg, justifyContent: 'center',
  },
  riderBadge: {
    backgroundColor: 'rgba(255,79,0,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,79,0,0.3)',
  },
});
