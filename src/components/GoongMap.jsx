import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import goongService from '../services/goongService';

const { width, height } = Dimensions.get('window');

const GoongMap = ({
  initialRegion,
  markers = [],
  onMapPress,
  onMarkerPress,
  showsUserLocation = true,
  style,
  polyline = null,
  ...props
}) => {
  const webViewRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Generate HTML for the map (only once to prevent WebView reload)
  const generateMapHTML = React.useCallback(() => {
    const center = initialRegion ? 
      [initialRegion.latitude, initialRegion.longitude] : 
      [10.8231, 106.6297]; // Default to Ho Chi Minh City

    const zoom = initialRegion ? 
      Math.round(15 - Math.log2(initialRegion.latitudeDelta * 111)) : 
      15;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Goong Map</title>
    <script src="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css" rel="stylesheet" />
    <style>
        body { margin: 0; padding: 0; }
        #map { 
            position: absolute; 
            top: 0; 
            bottom: 0; 
            width: 100%; 
            height: 100vh;
        }
        .marker-popup {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        goongjs.accessToken = '${goongService.mapsApiKey}';
        
        const map = new goongjs.Map({
            container: 'map',
            style: 'https://tiles.goong.io/assets/goong_map_web.json',
            center: [${center[1]}, ${center[0]}],
            zoom: ${zoom}
        });
        
        map.on('load', function() {
        });
        

        let markers = [];
        let polylineLayer = null;

        // Map ready event
        map.on('load', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapReady'
            }));
            
            // Add user location if enabled
            ${showsUserLocation ? `
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const userLocation = [position.coords.longitude, position.coords.latitude];
                    
                    new goongjs.Marker({ color: '#4CAF50' })
                        .setLngLat(userLocation)
                        .addTo(map);
                });
            }
            ` : ''}
        });

        // Map click event
        map.on('click', function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapPress',
                coordinate: {
                    latitude: e.lngLat.lat,
                    longitude: e.lngLat.lng
                }
            }));
        });

        // Function to add markers
        function addMarkers(markerData) {
            // Clear existing markers
            markers.forEach(marker => marker.remove());
            markers = [];

            markerData.forEach(function(markerInfo, index) {
                // Handle coordinate format: can be {latitude, longitude} or separate lat/lng
                const lat = markerInfo.latitude || markerInfo.coordinate?.latitude || markerInfo.lat || 0;
                const lng = markerInfo.longitude || markerInfo.coordinate?.longitude || markerInfo.lng || 0;
                
                if (!lat || !lng) {
                    console.warn('Invalid marker coordinates:', markerInfo);
                    return;
                }
                
                const marker = new goongjs.Marker({ 
                    color: markerInfo.pinColor || '#FF0000',
                    anchor: 'bottom'
                })
                .setLngLat([lng, lat])
                .addTo(map);

                if (markerInfo.title || markerInfo.description) {
                    const popup = new goongjs.Popup({ offset: 25 })
                        .setHTML(\`
                            <div class="marker-popup">
                                \${markerInfo.title ? \`<strong>\${markerInfo.title}</strong><br>\` : ''}
                                \${markerInfo.description || ''}
                            </div>
                        \`);
                    marker.setPopup(popup);
                }

                marker.getElement().addEventListener('click', function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'markerPress',
                        markerId: index,
                        coordinate: {
                            latitude: markerInfo.latitude,
                            longitude: markerInfo.longitude
                        }
                    }));
                });

                markers.push(marker);
            });
        }

        // Function to add polyline
        function addPolyline(coordinates) {
            
            if (polylineLayer) {
                map.removeLayer('polyline');
                map.removeSource('polyline');
            }

            if (coordinates && coordinates.length > 0) {
                map.addSource('polyline', {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': (coordinates || []).map(coord => 
                                Array.isArray(coord) ? coord : [coord.longitude, coord.latitude]
                            )
                        }
                    }
                });

                map.addLayer({
                    'id': 'polyline',
                    'type': 'line',
                    'source': 'polyline',
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': '#1976D2',
                        'line-width': 6,
                        'line-opacity': 0.9
                    }
                });

                polylineLayer = true;
            } else {
            }
        }

        // Function to animate to region
        function animateToRegion(region) {
            map.flyTo({
                center: [region.longitude, region.latitude],
                zoom: Math.round(15 - Math.log2(region.latitudeDelta * 111)),
                duration: 1000
            });
        }

        // Function to fit bounds
        function fitToCoordinates(coordinates, padding = 50) {
            if (coordinates.length === 0) return;
            
            if (coordinates.length === 1) {
                map.flyTo({
                    center: [coordinates[0].longitude, coordinates[0].latitude],
                    zoom: 15
                });
                return;
            }

            const bounds = new goongjs.LngLatBounds();
            coordinates.forEach(coord => {
                bounds.extend([coord.longitude, coord.latitude]);
            });

            map.fitBounds(bounds, { padding: padding });
        }

        // Listen for messages from React Native
        function handleRNMessage(event) {
            try {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'addMarkers':
                        addMarkers(data.markers);
                        break;
                    case 'addPolyline':
                        addPolyline(data.coordinates);
                        break;
                    case 'animateToRegion':
                        animateToRegion(data.region);
                        break;
                    case 'fitToCoordinates':
                        fitToCoordinates(data.coordinates, data.padding);
                        break;
                }
            } catch (e) {
            }
        }

        // Listen on both document and window for cross-platform compatibility
        document.addEventListener('message', handleRNMessage);
        window.addEventListener('message', handleRNMessage);

        // Markers and polyline will be injected via JavaScript after mapReady
        
    </script>
</body>
</html>`;
  }, []); // Only generate once to prevent WebView reload

  // Memoize HTML content to prevent WebView reload  
  const htmlContent = React.useMemo(() => generateMapHTML(), []); // Fixed content

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          break;
        case 'mapPress':
          if (onMapPress) {
            onMapPress({ nativeEvent: data });
          }
          break;
        case 'markerPress':
          if (onMarkerPress) {
            onMarkerPress(data.markerId, data.coordinate);
          }
          break;
      }
    } catch (error) {
    }
  };

  // Public methods (similar to MapView)
  const animateToRegion = (region, duration = 1000) => {
    if (webViewRef.current && mapReady) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'animateToRegion',
        region: region
      }));
    }
  };

  const fitToCoordinates = (coordinates, options = {}) => {
    if (webViewRef.current && mapReady) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'fitToCoordinates',
        coordinates: coordinates,
        padding: options.edgePadding || 50
      }));
    }
  };

  // Expose methods to parent component
  useEffect(() => {
    if (!props.onRef) return;

    const api = { animateToRegion, fitToCoordinates };

    // Support both callback ref and object ref
    if (typeof props.onRef === 'function') {
      props.onRef(api);
    } else if (typeof props.onRef === 'object') {
      try {
        props.onRef.current = api;
      } catch (_) {
        // noop: prevent crashing if a non-function, non-ref is passed
      }
    }
  }, [mapReady]);

  // Update markers and polyline when mapReady or props change
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;

    // Update markers
    if (markers && markers.length > 0) {
      const formattedMarkers = markers.map(marker => {
        // Handle different coordinate formats
        const coord = marker.coordinate || marker;
        return {
          latitude: coord.latitude || coord.lat,
          longitude: coord.longitude || coord.lng,
          title: marker.title,
          description: marker.description,
          pinColor: marker.pinColor
        };
      }).filter(m => m.latitude && m.longitude); // Filter out invalid markers
      
      webViewRef.current.postMessage(JSON.stringify({
        type: 'addMarkers',
        markers: formattedMarkers
      }));
    }

    // Update polyline
    if (polyline && polyline.length > 0) {
      const jsCode = `
        if (typeof addPolyline === 'function') {
          addPolyline(${JSON.stringify(polyline)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }
  }, [mapReady, markers, polyline]);

  if (!goongService.isMapsConfigured()) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Vui lòng cấu hình Goong API key trong goongService.js
          </Text>
          <Text style={styles.errorSubtext}>
            Lấy API key miễn phí tại: https://account.goong.io/
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        onLoad={() => {
          // WebView loaded
        }}
        onError={(error) => {
        }}
        onHttpError={(error) => {
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default GoongMap;
