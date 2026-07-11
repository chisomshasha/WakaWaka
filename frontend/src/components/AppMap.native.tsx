// Native map implementation using MapLibre (@maplibre/maplibre-react-native)
// with OpenFreeMap's free vector styles — no API key, no billing account,
// no request cap, unlike Google/Mapbox. Two-finger rotate and pinch zoom are
// native gestures (enabled by default); zoom caps at z20, which resolves
// individual buildings — well under 5m on the ground.
//
// Includes a built-in style switcher (liberty / bright / positron — all
// free OpenFreeMap styles) via a small floating button, so every screen
// using AppMap gets it without extra plumbing.
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Map as MapLibreMap, Camera, Marker, UserLocation, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/src/theme';
import type { AppMapProps, Coord, MapMarker } from './AppMap';

export type { Coord, MapMarker, AppMapProps } from './AppMap';

// All free, no API key, no usage cap — https://openfreemap.org
const MAP_STYLES = [
  { id: 'liberty', label: 'Streets', url: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'bright', label: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'positron', label: 'Light', url: 'https://tiles.openfreemap.org/styles/positron' },
] as const;

export interface AppMapRef {
  /** Animate the camera to a new center, keeping (or setting) a zoom level. */
  flyTo: (coord: Coord, zoom?: number) => void;
}

function MarkerContent({ variant }: { variant: MapMarker['variant'] }) {
  if (variant === 'rider') {
    return (
      <View style={[styles.pin, { backgroundColor: Colors.okadaOrange }]}>
        <MaterialCommunityIcons name="motorbike" color="#fff" size={18} />
      </View>
    );
  }
  if (variant === 'pickup') {
    return (
      <View style={[styles.pin, { backgroundColor: Colors.asphaltBlack }]}>
        <MaterialCommunityIcons name="package-variant" color="#fff" size={16} />
      </View>
    );
  }
  if (variant === 'dropoff') {
    return (
      <View style={[styles.pin, { backgroundColor: Colors.success }]}>
        <MaterialCommunityIcons name="flag-checkered" color="#fff" size={16} />
      </View>
    );
  }
  return <View style={[styles.pin, { backgroundColor: Colors.info, width: 20, height: 20 }]} />;
}

// Rough conversion from a react-native-maps-style latitudeDelta to a MapLibre
// zoom level, so existing callers (which pass deltas) still land on a sane
// initial zoom without every screen needing to change.
function deltaToZoom(delta?: number) {
  if (!delta || delta <= 0) return 15;
  const zoom = Math.log2(360 / delta);
  return Math.max(3, Math.min(20, zoom));
}

export const AppMap = forwardRef<AppMapRef, AppMapProps>(function AppMap(
  {
    region, markers = [], route, style, showsUserLocation,
    onMapPress, onMapLongPress, maxZoomLevel, showStyleSwitcher = true, testID,
  },
  ref
) {
  const cameraRef = useRef<CameraRef>(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const activeStyle = MAP_STYLES[styleIndex];

  useImperativeHandle(ref, () => ({
    flyTo: (coord, zoom) => {
      cameraRef.current?.flyTo({
        center: [coord.longitude, coord.latitude],
        zoom,
        duration: 600,
      });
    },
  }));

  const initialZoom = useMemo(() => deltaToZoom(region.latitudeDelta), [region.latitudeDelta]);

  const routeGeoJson = useMemo(() => {
    if (!route || route.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: route.map((c) => [c.longitude, c.latitude]),
      },
    };
  }, [route]);

  return (
    <View style={[{ flex: 1 }, style]} testID={testID}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={activeStyle.url}
        onPress={(e: any) => {
          if (!onMapPress) return;
          const lngLat = e?.nativeEvent?.lngLat;
          if (Array.isArray(lngLat) && lngLat.length >= 2) {
            onMapPress({ latitude: lngLat[1], longitude: lngLat[0] });
          }
        }}
        onLongPress={(e: any) => {
          if (!onMapLongPress) return;
          const lngLat = e?.nativeEvent?.lngLat;
          if (Array.isArray(lngLat) && lngLat.length >= 2) {
            onMapLongPress({ latitude: lngLat[1], longitude: lngLat[0] });
          }
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [region.longitude, region.latitude],
            zoom: initialZoom,
          }}
          maxZoom={maxZoomLevel ?? 20}
        />

        {showsUserLocation ? <UserLocation /> : null}

        {routeGeoJson ? (
          <GeoJSONSource id="routeSource" data={routeGeoJson as any}>
            <Layer
              id="routeLine"
              type="line"
              paint={{ 'line-color': Colors.routeLine, 'line-width': 4 }}
            />
          </GeoJSONSource>
        ) : null}

        {markers.map((m) => (
          <Marker key={m.id} id={m.id} lngLat={[m.coord.longitude, m.coord.latitude]}>
            <MarkerContent variant={m.variant} />
          </Marker>
        ))}
      </MapLibreMap>

      {showStyleSwitcher ? (
        <TouchableOpacity
          style={styles.styleSwitcher}
          onPress={() => setStyleIndex((i) => (i + 1) % MAP_STYLES.length)}
          testID="map-style-switcher"
        >
          <MaterialCommunityIcons name="layers-outline" size={18} color={Colors.asphaltBlack} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  pin: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 5,
  },
  styleSwitcher: {
    position: 'absolute', top: 12, right: 12,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
});
