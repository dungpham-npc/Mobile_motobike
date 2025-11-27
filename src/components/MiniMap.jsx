import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import goongService from '../services/goongService';

const { width } = Dimensions.get('window');

const MiniMap = ({
  startLocation,
  endLocation,
  polyline = null,
  style,
  height = 200,
}) => {
  const webViewRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Calculate center and bounds
  const getMapConfig = () => {
    if (!startLocation || !endLocation) {
      return {
        center: [10.8231, 106.6297], // Default to Ho Chi Minh City
        zoom: 13,
      };
    }

    const startLat = startLocation.lat || startLocation.latitude;
    const startLng = startLocation.lng || startLocation.longitude;
    const endLat = endLocation.lat || endLocation.latitude;
    const endLng = endLocation.lng || endLocation.longitude;

    const centerLat = (startLat + endLat) / 2;
    const centerLng = (startLng + endLng) / 2;

    // Calculate zoom to fit both points
    const latDelta = Math.abs(startLat - endLat);
    const lngDelta = Math.abs(startLng - endLng);
    const maxDelta = Math.max(latDelta, lngDelta);
    const zoom = maxDelta > 0.1 ? 12 : maxDelta > 0.05 ? 13 : 14;

    return {
      center: [centerLat, centerLng],
      zoom: zoom,
      start: [startLat, startLng],
      end: [endLat, endLng],
    };
  };

  const mapConfig = getMapConfig();

  // Generate HTML for the mini map (Grab-style)
  const generateMapHTML = React.useCallback(() => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Mini Map</title>
    <script src="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css" rel="stylesheet" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #map { 
            position: absolute; 
            top: 0; 
            left: 0;
            bottom: 0; 
            right: 0;
            width: 100%; 
            height: 100%;
        }
        .goong-logo {
            position: absolute;
            bottom: 8px;
            left: 8px;
            background: rgba(255, 255, 255, 0.9);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            color: #333;
            z-index: 1000;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .goong-logo::before {
            content: "G";
            display: inline-block;
            width: 14px;
            height: 14px;
            background: #1976D2;
            color: white;
            border-radius: 3px;
            text-align: center;
            line-height: 14px;
            font-size: 10px;
            font-weight: bold;
            margin-right: 4px;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <div class="goong-logo">Goong.io</div>
    <script>
        goongjs.accessToken = '${goongService.mapsApiKey}';
        
        const map = new goongjs.Map({
            container: 'map',
            style: 'https://tiles.goong.io/assets/goong_map_web.json',
            center: [${mapConfig.center[1]}, ${mapConfig.center[0]}],
            zoom: ${mapConfig.zoom},
            interactive: false,
            attributionControl: false
        });
        
        let polylineLayer = null;
        let startMarker = null;
        let endMarker = null;

        map.on('load', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapReady'
            }));
            
            // Add start marker (red pin)
            ${mapConfig.start ? `
            startMarker = new goongjs.Marker({ 
                color: '#F44336',
                anchor: 'bottom',
                scale: 0.8
            })
            .setLngLat([${mapConfig.start[1]}, ${mapConfig.start[0]}])
            .addTo(map);
            ` : ''}
            
            // Add end marker (blue pin)
            ${mapConfig.end ? `
            endMarker = new goongjs.Marker({ 
                color: '#2196F3',
                anchor: 'bottom',
                scale: 0.8
            })
            .setLngLat([${mapConfig.end[1]}, ${mapConfig.end[0]}])
            .addTo(map);
            ` : ''}
            
            // Fit bounds to show both markers
            ${mapConfig.start && mapConfig.end ? `
            const bounds = new goongjs.LngLatBounds();
            bounds.extend([${mapConfig.start[1]}, ${mapConfig.start[0]}]);
            bounds.extend([${mapConfig.end[1]}, ${mapConfig.end[0]}]);
            map.fitBounds(bounds, { 
                padding: { top: 20, bottom: 20, left: 20, right: 20 },
                duration: 0
            });
            ` : ''}
        });

        // Function to add polyline (green line like Grab)
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
                                Array.isArray(coord) ? coord : [coord.longitude || coord[0], coord.latitude || coord[1]]
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
                        'line-color': '#22C55E', // Green color like Grab
                        'line-width': 5,
                        'line-opacity': 0.9
                    }
                });

                polylineLayer = true;
                
                // Fit bounds to polyline
                const bounds = new goongjs.LngLatBounds();
                coordinates.forEach(coord => {
                    const lng = Array.isArray(coord) ? coord[0] : (coord.longitude || coord[0]);
                    const lat = Array.isArray(coord) ? coord[1] : (coord.latitude || coord[1]);
                    bounds.extend([lng, lat]);
                });
                map.fitBounds(bounds, { 
                    padding: { top: 20, bottom: 20, left: 20, right: 20 },
                    duration: 0
                });
            }
        }

        // Listen for messages from React Native
        function handleRNMessage(event) {
            try {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'addPolyline':
                        addPolyline(data.coordinates);
                        break;
                }
            } catch (e) {
                console.error('Error handling message:', e);
            }
        }

        document.addEventListener('message', handleRNMessage);
        window.addEventListener('message', handleRNMessage);
    </script>
</body>
</html>`;
  }, [mapConfig]);

  const htmlContent = React.useMemo(() => generateMapHTML(), [generateMapHTML]);

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setMapReady(true);
      }
    } catch (error) {
      // Silent fail
    }
  };

  // Update polyline when mapReady or polyline changes
  useEffect(() => {
    if (!mapReady || !webViewRef.current || !polyline || polyline.length === 0) return;

    webViewRef.current.postMessage(JSON.stringify({
      type: 'addPolyline',
      coordinates: polyline
    }));
  }, [mapReady, polyline]);

  if (!goongService.isMapsConfigured()) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map không khả dụng</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default MiniMap;

