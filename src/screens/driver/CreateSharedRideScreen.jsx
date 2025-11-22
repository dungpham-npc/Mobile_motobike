import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Switch,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import rideService from "../../services/rideService";
import poiService from "../../services/poiService";
import routeService from "../../services/routeService";
import authService from "../../services/authService";
import AddressInput from "../../components/AddressInput";
import CampusAnchorPicker from "../../components/CampusAnchorPicker";
import locationService from "../../services/LocationService";
import goongService from "../../services/goongService";
import GoongMap from "../../components/GoongMap";
import { locationStorageService } from "../../services/locationStorageService";

const { width, height } = Dimensions.get('window');

const CreateSharedRideScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [hasScheduledTime, setHasScheduledTime] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Location states
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");

  useEffect(() => {
    loadVehicles();
    getCurrentLocation();
  }, []);

  // Initialize campus anchors with fallback values
  useEffect(() => {
    const fallbackFPT = {
      id: null,
      locationId: null,
      name: 'FPT University - HCMC Campus',
      address: 'FPT University - HCMC Campus',
      latitude: 10.841480,
      longitude: 106.809844,
      isPOI: false
    };
    const fallbackSCH = {
      id: null,
      locationId: null,
      name: 'Nhà Văn Hóa Sinh Viên',
      address: 'Nhà Văn Hóa Sinh Viên',
      latitude: 10.8753395,
      longitude: 106.8000331,
      isPOI: false
    };
    
    if (!fptUniversityLocation) {
      setFptUniversityLocation(fallbackFPT);
    }
    if (campusAnchors.length === 0) {
      setCampusAnchors([fallbackFPT, fallbackSCH]);
    }

    // Fetch from POI service
    const fetchCampusAnchors = async () => {
      try {
        const allLocations = await poiService.getAllLocations();
        const fptUniversity = allLocations.find(loc => 
          (loc.name && (loc.name.includes('FPT University') || loc.name.includes('FPTU'))) ||
          (Math.abs(loc.latitude - 10.841480) < 0.001 && Math.abs(loc.longitude - 106.809844) < 0.001)
        );
        const studentCultureHouse = allLocations.find(loc =>
          (loc.name && (loc.name.includes('Nhà Văn Hóa') || loc.name.includes('Student Culture'))) ||
          (Math.abs(loc.latitude - 10.8753395) < 0.001 && Math.abs(loc.longitude - 106.8000331) < 0.001)
        );

        const anchors = [];
        let fptLoc = null;
        
        if (fptUniversity) {
          fptLoc = {
            ...fptUniversity,
            name: fptUniversity.name || 'FPT University - HCMC Campus',
            address: fptUniversity.name || 'FPT University - HCMC Campus'
          };
          anchors.push(fptLoc);
        }
        
        if (studentCultureHouse) {
          anchors.push({
            ...studentCultureHouse,
            name: studentCultureHouse.name || 'Nhà Văn Hóa Sinh Viên',
            address: studentCultureHouse.name || 'Nhà Văn Hóa Sinh Viên'
          });
        }

        if (fptLoc) {
          setFptUniversityLocation(fptLoc);
        }
        if (anchors.length > 0) {
          setCampusAnchors(anchors);
        }
      } catch (error) {
        console.error('Error fetching campus anchors:', error);
      }
    };
    fetchCampusAnchors();
  }, []);

  // Update campus anchor flags when locations change
  useEffect(() => {
    setStartIsCampusAnchor(isCampusAnchor(startLocation, startAddress));
  }, [startLocation, campusAnchors, startAddress]);

  useEffect(() => {
    setEndIsCampusAnchor(isCampusAnchor(endLocation, endAddress));
  }, [endLocation, campusAnchors, endAddress]);

  // Set initial region once when currentLocation is available
  useEffect(() => {
    if (currentLocation && !initialRegionRef.current) {
      initialRegionRef.current = locationService.getMapRegion(
        currentLocation.latitude,
        currentLocation.longitude
      );
    }
  }, [currentLocation]);

  // Fetch template routes on mount
  useEffect(() => {
    const fetchTemplateRoutes = async () => {
      try {
        setLoadingRoutes(true);
        const routes = await routeService.getTemplateRoutes();
        setTemplateRoutes(routes);
      } catch (error) {
        console.error('Error fetching template routes:', error);
        // Don't show error alert - just log it, user can still use custom mode
      } finally {
        setLoadingRoutes(false);
      }
    };

    fetchTemplateRoutes();
  }, []);

  // Memoized markers
  const mapMarkers = React.useMemo(() => {
    const markers = [];
    if (startLocation) {
      markers.push({
        coordinate: startLocation,
        title: "Điểm đi",
        description: startAddress,
        pinColor: "#4CAF50"
      });
    }
    if (endLocation) {
      markers.push({
        coordinate: endLocation,
        title: "Điểm đến",
        description: endAddress,
        pinColor: "#F44336"
      });
    }
    return markers;
  }, [startLocation, endLocation, startAddress, endAddress]);

  const initializeLocation = async () => {
    try {
      setLoadingLocation(true);
      
      const locationData = await locationStorageService.getCurrentLocationWithAddress();
      
      if (locationData.location) {
        setCurrentLocation(locationData.location);
      } else {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
      }
    } catch (error) {
      console.error("Error initializing location:", error);
    } finally {
      setLoadingLocation(false);
    }
  };

  /*
  const handleMapPress = async (event) => {
    if (!isSelectingStart && !isSelectingEnd) {
      return;
    }

    try {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      
      const address = await locationService.getAddressFromCoordinates(latitude, longitude);
      const addressText = address?.formattedAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      const nearbyPOI = await poiService.findLocationByCoordinates(latitude, longitude, 200);

      if (response && response.data) {
        const formattedVehicles = vehicleService.formatVehicles(response.data);
        setVehicles(formattedVehicles);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error handling map press:', error);
      Alert.alert('Lỗi', 'Không thể xác định địa chỉ cho vị trí này');
    }
  };
  */

      Alert.alert("Lỗi", errorMessage, [
        { text: "OK" },
        {
          text: "Thêm phương tiện",
          onPress: () => {
            // TODO: Navigate to add vehicle screen
          },
        },
      ]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleCreateRide = async () => {

    setSelectedRoute(route);
    
    // Populate locations from route
    if (route.fromLocation) {
      setStartLocation(route.fromLocation);
      setStartAddress(route.fromLocationName || route.fromLocation.name || 'Điểm đi');
    }
    
    if (route.toLocation) {
      setEndLocation(route.toLocation);
      setEndAddress(route.toLocationName || route.toLocation.name || 'Điểm đến');
    }

    // Decode and display route polyline on map
    if (route.polyline) {
      try {
        const decodedPolyline = goongService.decodePolyline(route.polyline);
        const formattedPolyline = decodedPolyline.map(point => [point.longitude, point.latitude]);
        setRoutePolyline(formattedPolyline);
        
        // Fit map to route
        if (mapRef.current && route.fromLocation && route.toLocation) {
          setTimeout(() => {
            mapRef.current.fitToCoordinates(
              [
                { latitude: route.fromLocation.latitude, longitude: route.fromLocation.longitude },
                { latitude: route.toLocation.latitude, longitude: route.toLocation.longitude }
              ],
              {
                edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                animated: true,
              }
            );
          }, 500);
        }
      } catch (error) {
        console.error('Error decoding route polyline:', error);
      }
    }
  };

  const handleModeSwitch = (mode) => {
    setBookingMode(mode);
    
    // Clear selections when switching modes
    if (mode === 'custom') {
      setSelectedRoute(null);
      setRoutePolyline(null);
    } else {
      // Clear custom locations when switching to predefined
      setStartLocation(null);
      setEndLocation(null);
      setStartAddress('');
      setEndAddress('');
      setRoutePolyline(null);
      setStartIsCampusAnchor(false);
      setEndIsCampusAnchor(false);
    }
  };

  const handleCreateRide = async () => {
    // If in predefined mode, check if route is selected
    if (bookingMode === 'predefined') {
      if (!selectedRoute) {
        Alert.alert('Thông báo', 'Vui lòng chọn tuyến đường');
        return;
      }
    } else {
      // Custom mode validation
      if (!startAddress.trim() || !endAddress.trim()) {
        Alert.alert("Lỗi", "Vui lòng chọn điểm đi và điểm đến");
        return;
      }
    }

    // Handle manual address input (geocode if location is null)
    let processedStartLocation = startLocation;
    let processedEndLocation = endLocation;

    try {
      setLoading(true);

      // If startLocation is null, try to geocode the address
      if (!processedStartLocation && startAddress.trim()) {
        try {
          const geocodeResults = await goongService.geocode(
            startAddress.trim()
          );
          if (
            geocodeResults &&
            geocodeResults.geometry &&
            geocodeResults.geometry.location
          ) {
            const location = geocodeResults.geometry.location;
            processedStartLocation = {
              latitude: location.latitude,
              longitude: location.longitude,
              address: startAddress.trim(),
            };
          }
        } catch (error) {
          console.error("❌ Failed to geocode start address:", error);
        }
      }

      // If endLocation is null, try to geocode the address
      if (!processedEndLocation && endAddress.trim()) {
        try {
          const geocodeResults = await goongService.geocode(endAddress.trim());
          if (
            geocodeResults &&
            geocodeResults.geometry &&
            geocodeResults.geometry.location
          ) {
            const location = geocodeResults.geometry.location;
            processedEndLocation = {
              latitude: location.latitude,
              longitude: location.longitude,
              address: endAddress.trim(),
            };
          }
        } catch (error) {
          console.error("❌ Failed to geocode end address:", error);
        }
      }

      // Final validation (only for custom mode)
      if (bookingMode === 'custom' && (!processedStartLocation || !processedEndLocation)) {
        Alert.alert(
          "Lỗi",
          "Không thể xác định tọa độ cho địa chỉ đã nhập. Vui lòng chọn từ danh sách gợi ý hoặc nhập địa chỉ chính xác hơn."
        );
        return;
      }
      */
      
      // For predefined mode, use locations from selected route
      if (bookingMode === 'predefined' && selectedRoute) {
        processedStartLocation = selectedRoute.fromLocation;
        processedEndLocation = selectedRoute.toLocation;
      }

      // Prepare request body to match expected format
      const rideData = {};

      // If predefined route is selected, use routeId
      if (bookingMode === 'predefined' && selectedRoute?.routeId) {
        rideData.routeId = selectedRoute.routeId;
        // Still include locations for validation/display purposes
        if (processedStartLocation) {
          if (processedStartLocation.locationId) {
            rideData.startLocationId = processedStartLocation.locationId;
          } else {
            rideData.startLatLng = {
              latitude: processedStartLocation.latitude,
              longitude: processedStartLocation.longitude,
            };
          }
        }
        if (processedEndLocation) {
          if (processedEndLocation.locationId) {
            rideData.endLocationId = processedEndLocation.locationId;
          } else {
            rideData.endLatLng = {
              latitude: processedEndLocation.latitude,
              longitude: processedEndLocation.longitude,
            };
          }
        }
      }
      /* else {
        // Custom mode - add location data based on whether it's POI or coordinates
        if (processedStartLocation.locationId) {
          // Use POI location ID
          rideData.startLocationId = processedStartLocation.locationId;
        } else {
          // Use coordinates
          rideData.startLatLng = {
            latitude: processedStartLocation.latitude,
            longitude: processedStartLocation.longitude,
          };
        }

        if (processedEndLocation.locationId) {
          // Use POI location ID
          rideData.endLocationId = processedEndLocation.locationId;
        } else {
          // Use coordinates
          rideData.endLatLng = {
            latitude: processedEndLocation.latitude,
            longitude: processedEndLocation.longitude,
          };
        }
      }
      */

      const result = await rideService.createSharedRide(rideData);

      Alert.alert(
        "Thành công!",
        `Đã tạo chuyến đi chia sẻ `,
        [
          {
            text: "Xem chi tiết",
            onPress: () => {
              navigation.goBack();
              // TODO: Navigate to ride details
            },
          },
          {
            text: "Tạo thêm",
            onPress: () => {
              // Reset form
              setStartLocation(null);
              setEndLocation(null);
              setStartAddress("");
              setEndAddress("");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Create shared ride error:", error);
      let errorMessage = "Không thể tạo chuyến đi. Vui lòng thử lại.";

      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo chuyến chia sẻ</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Map */}
        {goongService.isMapsConfigured() ? (
          <GoongMap
            onRef={(ref) => (mapRef.current = ref)}
            style={styles.map}
            initialRegion={
              initialRegionRef.current || {
                latitude: 10.8231,
                longitude: 106.6297,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            }
            showsUserLocation={true}
            markers={mapMarkers}
            polyline={routePolyline}
          />
        ) : (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <View style={styles.mapPlaceholderContent}>
              <Icon name="map" size={60} color="#ccc" />
              <Text style={styles.mapPlaceholderTitle}>Bản đồ không khả dụng</Text>
              <Text style={styles.mapPlaceholderText}>
                Vui lòng cấu hình Goong API key{'\n'}
                hoặc sử dụng chức năng nhập địa chỉ bên dưới
              </Text>
            </View>
          </View>
        )}

        {/* Location Selection Overlay disabled */}
        {false && (isSelectingStart || isSelectingEnd) && (
          <View style={styles.selectionOverlay}>
            <View style={styles.crosshair}>
              <Icon name="my-location" size={30} color="#4CAF50" />
            </View>
            <Animatable.View 
              animation="slideInUp" 
              style={styles.selectionPrompt}
            >
              <Text style={styles.selectionText}>
                {isSelectingStart ? 'Chọn điểm đi' : 'Chọn điểm đến'}
              </Text>
              <TouchableOpacity
                style={styles.cancelSelectionButton}
                onPress={() => {
                  setIsSelectingStart(false);
                  setIsSelectingEnd(false);
                }}
              >
                <Text style={styles.cancelSelectionText}>Hủy</Text>
              </TouchableOpacity>
            </Animatable.View>
          </View>
        )}

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabledButton]}
            onPress={handleCreateRide}
            disabled={loading}
          >
            {/* Mode Selection disabled */}
            {false && (
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  bookingMode === 'predefined' && styles.modeButtonActive
                ]}
                onPress={() => handleModeSwitch('predefined')}
              >
                <Icon 
                  name="route" 
                  size={18} 
                  color={bookingMode === 'predefined' ? '#fff' : '#666'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.modeButtonText,
                  bookingMode === 'predefined' && styles.modeButtonTextActive
                ]}>
                  Tuyến đường có sẵn
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  bookingMode === 'custom' && styles.modeButtonActive
                ]}
                onPress={() => handleModeSwitch('custom')}
              >
                <Icon 
                  name="edit-location" 
                  size={18} 
                  color={bookingMode === 'custom' ? '#fff' : '#666'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.modeButtonText,
                  bookingMode === 'custom' && styles.modeButtonTextActive
                ]}>
                  Tùy chọn
                </Text>
              </TouchableOpacity>
            </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 40,
  },
  map: {
    width: width,
    height: height * 0.4,
  },
  mapPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderContent: {
    alignItems: "center",
    padding: 20,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginTop: 16,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  selectionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -15,
    marginLeft: -15,
  },
  selectionPrompt: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  cancelSelectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelSelectionText: {
    fontSize: 16,
    color: "#F44336",
    fontWeight: "600",
  },
  controlButtons: {
    position: "absolute",
    right: 16,
    top: height * 0.4 + 20,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scheduleNote: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  scheduleNoteText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  addressInput: {
    marginBottom: 5,
  },
  mapSelectionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  mapSelectionText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  locationDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 25,
    marginVertical: 5,
  },
  dividerLine: {
    width: 1,
    height: 8,
    backgroundColor: "#ddd",
    marginHorizontal: 2,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: "#856404",
    lineHeight: 16,
  },
  dateTimeButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  dateTimeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
  inputRow: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    width: 100,
    textAlign: "center",
    fontSize: 16,
  },
  createButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 32,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  // Mode Selector Styles
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Route Selector Styles
  routeSelector: {
    flex: 1,
  },
  loadingRoutesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingRoutesText: {
    fontSize: 14,
    color: '#666',
  },
  emptyRoutesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyRoutesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
  routesList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  routeCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  routeCardContent: {
    flex: 1,
  },
  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  routeCardNameSelected: {
    color: '#4CAF50',
  },
  routeCardLocations: {
    marginBottom: 8,
  },
  routeLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeLocationText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  routeCardPrice: {
    marginTop: 4,
  },
  routePriceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  routeCardCheck: {
    marginLeft: 12,
  },
});

export default CreateSharedRideScreen;
