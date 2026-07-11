import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AppMap, AppMapRef } from '@/src/components/AppMap';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useAuth } from '@/src/context/auth';
import { Colors, Fonts, Radii, Spacing, Shadows } from '@/src/theme';

// Quick-select Lagos landmarks, so common spots don't need typing/GPS at all.
const LANDMARKS = [
  { name: 'Victoria Island', lat: 6.4281, lng: 3.4219 },
  { name: 'Ikoyi', lat: 6.4550, lng: 3.4370 },
  { name: 'Lekki Phase 1', lat: 6.4474, lng: 3.4553 },
  { name: 'Yaba', lat: 6.5158, lng: 3.3746 },
  { name: 'Surulere', lat: 6.5000, lng: 3.3583 },
  { name: 'Ikeja', lat: 6.6018, lng: 3.3515 },
];

type GeoResult = { label: string; lat: number; lng: number };

export default function LocationPicker() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const params = useLocalSearchParams<{ field: 'pickup' | 'dropoff'; lat?: string; lng?: string; label?: string }>();
  const field = params.field === 'dropoff' ? 'dropoff' : 'pickup';

  const initialLat = params.lat ? parseFloat(params.lat) : 6.4281;
  const initialLng = params.lng ? parseFloat(params.lng) : 3.4219;

  const mapRef = useRef<AppMapRef>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<GeoResult | null>(
    params.lat && params.lng ? { lat: initialLat, lng: initialLng, label: params.label || 'Selected location' } : null
  );

  // Debounced address search
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch(`/geocode/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.results || []);
      } catch (e) {
        console.log('geocode search err', e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, apiFetch]);

  const chooseResult = useCallback((r: GeoResult) => {
    setSelected(r);
    setResults([]);
    setQuery(r.label);
    mapRef.current?.flyTo({ latitude: r.lat, longitude: r.lng }, 16);
  }, []);

  const chooseLandmark = useCallback((l: (typeof LANDMARKS)[number]) => {
    chooseResult({ label: l.name, lat: l.lat, lng: l.lng });
  }, [chooseResult]);

  const chooseCoord = useCallback(async (lat: number, lng: number) => {
    // Show the pin immediately with a placeholder label, then fill in the
    // real address once reverse geocoding responds — feels instant even on
    // a slow connection.
    setSelected({ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
    setQuery('');
    setResults([]);
    try {
      const rev = await apiFetch(`/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (rev?.label) {
        setSelected({ label: rev.label, lat, lng });
        setQuery(rev.label);
      }
    } catch (e) {
      console.log('reverse geocode err', e);
    }
  }, [apiFetch]);

  const findMyself = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      let label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const rev = await apiFetch(`/geocode/reverse?lat=${latitude}&lng=${longitude}`);
        if (rev?.label) label = rev.label;
      } catch (e) {
        console.log('reverse geocode err', e);
      }
      const r = { label, lat: latitude, lng: longitude };
      setSelected(r);
      setQuery(label);
      setResults([]);
      mapRef.current?.flyTo({ latitude, longitude }, 17);
    } catch (e) {
      console.log('find myself err', e);
    } finally {
      setLocating(false);
    }
  }, [apiFetch]);

  const confirm = () => {
    if (!selected) return;
    router.back();
    router.setParams({
      field,
      lat: String(selected.lat),
      lng: String(selected.lng),
      address: selected.label,
      ts: String(Date.now()),
    } as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="location-picker-back-button">
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.asphaltBlack} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{field === 'pickup' ? 'Set pickup location' : 'Set dropoff location'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search an address in Lagos…"
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            testID="location-picker-search-input"
          />
          {searching ? <ActivityIndicator size="small" color={Colors.okadaOrange} /> : null}
        </View>

        {results.length > 0 && (
          <FlatList
            style={styles.resultsList}
            data={results}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => chooseResult(item)}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color={Colors.okadaOrange} />
                <Text style={styles.resultTxt} numberOfLines={2}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {results.length === 0 && query.trim().length === 0 && (
          <View style={styles.chipsRow}>
            {LANDMARKS.map((l) => (
              <TouchableOpacity key={l.name} style={styles.chip} onPress={() => chooseLandmark(l)} testID={`landmark-chip-${l.name.replace(/\s/g, '-').toLowerCase()}`}>
                <Text style={styles.chipTxt}>{l.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.findMyselfBtn} onPress={findMyself} disabled={locating} testID="find-myself-button">
          {locating ? (
            <ActivityIndicator size="small" color={Colors.okadaOrange} />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={Colors.okadaOrange} />
          )}
          <Text style={styles.findMyselfTxt}>{locating ? 'Getting your location…' : 'Find Myself on Map'}</Text>
        </TouchableOpacity>

        <View style={styles.mapWrap}>
          <AppMap
            ref={mapRef}
            region={{ latitude: initialLat, longitude: initialLng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
            markers={selected ? [{ id: 'selected', coord: { latitude: selected.lat, longitude: selected.lng }, variant: field }] : []}
            onMapLongPress={(coord) => chooseCoord(coord.latitude, coord.longitude)}
            testID="location-picker-map"
          />
          {selected ? (
            <View style={styles.selectedBanner}>
              <MaterialCommunityIcons name={field === 'pickup' ? 'package-variant' : 'flag-checkered'} size={16} color={Colors.asphaltBlack} />
              <Text style={styles.selectedTxt} numberOfLines={2}>{selected.label}</Text>
            </View>
          ) : (
            <View style={styles.selectedBanner}>
              <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textTertiary} />
              <Text style={[styles.selectedTxt, { color: Colors.textTertiary }]}>
                Search an address, tap a Lagos landmark, use "Find Myself on Map", or press and hold anywhere on the map
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="Confirm This Location"
            onPress={confirm}
            disabled={!selected}
            testID="location-picker-confirm-button"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm,
  },
  topTitle: { fontFamily: Fonts.headingBold, fontSize: 16, fontWeight: '800', color: Colors.asphaltBlack, letterSpacing: -0.3 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginTop: 4,
    backgroundColor: Colors.surface, borderRadius: Radii.lg,
    paddingHorizontal: 12, height: 48, ...Shadows.sm,
  },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 15, color: Colors.asphaltBlack, height: '100%' },
  resultsList: {
    marginHorizontal: Spacing.md, marginTop: 8, maxHeight: 220,
    backgroundColor: Colors.surface, borderRadius: Radii.lg, ...Shadows.sm,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  resultTxt: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.asphaltBlack },
  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginHorizontal: Spacing.md, marginTop: 10,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.round,
    backgroundColor: Colors.gray50, borderWidth: 1, borderColor: Colors.gray200,
  },
  chipTxt: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.asphaltBlack, fontWeight: '700' },
  findMyselfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginTop: 10, height: 44,
    borderRadius: Radii.lg, borderWidth: 1.5, borderColor: Colors.okadaOrange,
    backgroundColor: '#FFF4EE',
  },
  findMyselfTxt: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.okadaOrange, fontWeight: '800' },
  mapWrap: { flex: 1, marginTop: 12, borderRadius: 0, overflow: 'hidden' },
  selectedBanner: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radii.md,
    paddingHorizontal: 12, paddingVertical: 10, ...Shadows.md,
  },
  selectedTxt: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.asphaltBlack },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.gray100,
    backgroundColor: Colors.surface,
  },
});
