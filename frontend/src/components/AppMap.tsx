// Web fallback map (also used as the default in this file).
// Native platforms get AppMap.native.tsx via Metro's platform resolution.
import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radii, Spacing } from '@/src/theme';

export interface Coord {
  latitude: number;
  longitude: number;
}

export interface MapMarker {
  id: string;
  coord: Coord;
  label?: string;
  variant?: 'rider' | 'pickup' | 'dropoff' | 'me';
}

export interface AppMapProps {
  region: Coord & { latitudeDelta?: number; longitudeDelta?: number };
  markers?: MapMarker[];
  route?: Coord[];
  style?: any;
  showsUserLocation?: boolean;
  onRegionChange?: (r: any) => void;
  /** Fired with the tapped map coordinate. Used by the address picker. */
  onMapPress?: (coord: Coord) => void;
  /** Max zoom level (native only). Vector tiles comfortably support up to
   * ~z20, which resolves individual buildings (well under 5m on the ground). */
  maxZoomLevel?: number;
  testID?: string;
}

export interface AppMapRef {
  /** No-op on web — the interactive map (with rotate/deep zoom) is native-only. */
  flyTo: (coord: Coord, zoom?: number) => void;
}

function MarkerContent({ variant }: { variant: MapMarker['variant'] }) {
  if (variant === 'rider') {
    return (
      <View style={[markerStyles.pin, { backgroundColor: Colors.okadaOrange }]}>
        <MaterialCommunityIcons name="motorbike" color="#fff" size={18} />
      </View>
    );
  }
  if (variant === 'pickup') {
    return (
      <View style={[markerStyles.pin, { backgroundColor: Colors.asphaltBlack }]}>
        <MaterialCommunityIcons name="package-variant" color="#fff" size={16} />
      </View>
    );
  }
  if (variant === 'dropoff') {
    return (
      <View style={[markerStyles.pin, { backgroundColor: Colors.success }]}>
        <MaterialCommunityIcons name="flag-checkered" color="#fff" size={16} />
      </View>
    );
  }
  return <View style={[markerStyles.pin, { backgroundColor: Colors.info, width: 20, height: 20 }]} />;
}

export const AppMap = forwardRef<AppMapRef, AppMapProps>(function AppMap({ region, markers = [], style, testID }, ref) {
  useImperativeHandle(ref, () => ({ flyTo: () => {} }));
  return (
    <View testID={testID} style={[webStyles.container, style]}>
      <View style={webStyles.gridOverlay} />
      <View style={webStyles.header}>
        <MaterialCommunityIcons name="map-outline" size={20} color={Colors.textSecondary} />
        <Text style={webStyles.headerText}>Lagos, Nigeria — Live Map</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.md }} showsVerticalScrollIndicator={false}>
        {markers.length === 0 ? (
          <View style={webStyles.emptyCenter}>
            <MaterialCommunityIcons name="motorbike" size={64} color={Colors.gray300} />
            <Text style={webStyles.emptyTxt}>No riders in view</Text>
          </View>
        ) : (
          markers.map((m) => (
            <View key={m.id} style={webStyles.markerRow}>
              <MarkerContent variant={m.variant} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={webStyles.markerLabel}>{m.label || m.variant?.toUpperCase()}</Text>
                <Text style={webStyles.markerCoord}>
                  {m.coord.latitude.toFixed(4)}, {m.coord.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <Text style={webStyles.footer}>Full interactive map available on iOS / Android build</Text>
    </View>
  );
});

const markerStyles = StyleSheet.create({
  pin: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 5,
  },
});

const webStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2F6', overflow: 'hidden' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E8ECF1', opacity: 0.4 },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    backgroundColor: '#F8FAFC',
  },
  headerText: { marginLeft: 8, fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  markerRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: Colors.surface, borderRadius: Radii.md, marginBottom: 8,
  },
  markerLabel: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  markerCoord: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  emptyCenter: { alignItems: 'center', padding: Spacing.xl },
  emptyTxt: { fontFamily: Fonts.body, color: Colors.textTertiary, marginTop: 8 },
  footer: {
    textAlign: 'center', padding: Spacing.sm, fontSize: 11,
    color: Colors.textTertiary, fontFamily: Fonts.body,
    backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: Colors.divider,
  },
});
