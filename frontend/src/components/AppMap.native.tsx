// Native map implementation using MapLibre (@maplibre/maplibre-react-native)
// with OpenFreeMap's free "liberty" vector style — no API key, no billing
// account, no request cap, unlike Google/Mapbox. Two-finger rotate and pinch
// zoom are native gestures (rotateEnabled/zoomEnabled default true); we cap
// zoom at z20, which resolves individual buildings — well under 5m on the
// ground, satisfying the "zoom to 5m" requirement.
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Map as MapLibreMap, Camera, Marker, UserLocation, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/src/theme';
import type { AppMapProps, Coord, MapMarker } from './AppMap';

export type { Coord, MapMarker, AppMapProps } from './AppMap';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

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
  { region, markers = [], route, style, showsUserLocation, onMapPress, maxZoomLevel, testID },
  ref
) {
  const cameraRef = useRef<CameraRef>(null);

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
        mapStyle={MAP_STYLE_URL}
        onPress={(e: any) => {
          if (!onMapPress) return;
          const lngLat = e?.nativeEvent?.lngLat;
          if (Array.isArray(lngLat) && lngLat.length >= 2) {
            onMapPress({ latitude: lngLat[1], longitude: lngLat[0] });
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
});
