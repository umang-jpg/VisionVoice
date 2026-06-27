import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#222222' }] },
];

/**
 * Non-interactive route map for low-vision orientation aid.
 * Reads position from the navigation tracker — no second GPS subscription.
 */
export default function NavigationMap({ activeRoute, userPosition }) {
  const destination = activeRoute?.destination;
  const steps = activeRoute?.steps || [];

  const polylineCoords = useMemo(() => {
    const coords = steps.map((step) => ({
      latitude: step.latitude,
      longitude: step.longitude,
    }));
    if (activeRoute?.origin) {
      coords.unshift({
        latitude: activeRoute.origin.latitude,
        longitude: activeRoute.origin.longitude,
      });
    }
    return coords.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }, [activeRoute?.origin, steps]);

  const mapRegion = useMemo(() => {
    const anchor = userPosition || activeRoute?.origin || destination;
    if (!anchor) return null;
    return {
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }, [userPosition, activeRoute?.origin, destination]);

  if (!destination || !mapRegion) return null;

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityLabel="Route map showing your position and destination"
      accessibilityRole="image"
      importantForAccessibility="no-hide-descendants"
    >
      <MapView
        style={styles.map}
        customMapStyle={DARK_MAP_STYLE}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        pointerEvents="none"
      >
        {polylineCoords.length > 1 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#f5e2c8"
            strokeWidth={4}
          />
        ) : null}
        <Marker
          coordinate={{
            latitude: destination.latitude,
            longitude: destination.longitude,
          }}
          title={activeRoute.destinationName || 'Destination'}
          pinColor="#ec4e20"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  map: {
    flex: 1,
  },
});
