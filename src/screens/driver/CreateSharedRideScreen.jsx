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
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Animatable from 'react-native-animatable';

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
import GlassHeader, { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';

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

  // Map selection states
  const [isSelectingStart, setIsSelectingStart] = useState(false);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const mapRef = useRef(null);
  const initialRegionRef = useRef(null);
  const [routePolyline, setRoutePolyline] = useState(null);

  // Route selection states
  const [bookingMode, setBookingMode] = useState('predefined'); // 'predefined' | 'custom'
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [templateRoutes, setTemplateRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Campus anchor locations (required by business rule)
  const [campusAnchors, setCampusAnchors] = useState([]);
  const [fptUniversityLocation, setFptUniversityLocation] = useState(null);
  const [startIsCampusAnchor, setStartIsCampusAnchor] = useState(false);
  const [endIsCampusAnchor, setEndIsCampusAnchor] = useState(false);

  const [datePart, setDatePart] = React.useState(() => new Date());     // hôm nay
const [timePart, setTimePart] = React.useState(() => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + (5 - (d.getMinutes() % 5 || 5))); // làm tròn lên 5'
  d.setSeconds(0); d.setMilliseconds(0);
  return d;
});

  const [scheduledTime, setScheduledTime] = React.useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (5 - (d.getMinutes() % 5 || 5))); // làm tròn lên 5'
    d.setSeconds(0); d.setMilliseconds(0);
    return d;
  })

  // UI state
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [scheduledTimeIsoVN, setScheduledTimeIsoVN] = React.useState('');

  // Helper function to check if a location is a campus anchor
  const isCampusAnchor = (location, addressText = null) => {
    if (!location && !addressText) return false;
    
    const locationName = (location?.name || location?.address || addressText || '').toLowerCase().trim();
    const locationId = location?.locationId || location?.id;
    
    // First check: by name/address text patterns
    if (locationName) {
      const isFPT = locationName.includes('fpt university') || 
                    locationName.includes('fptu') ||
                    locationName.includes('fpt university - hcmc campus');
      const isSCH = locationName.includes('nhà văn hóa') ||
                    locationName.includes('nhà văn hóa sinh viên') ||
                    locationName.includes('student culture') ||
                    locationName.includes('student culture house');
      
      if (isFPT || isSCH) {
        return true;
      }
    }
    
    // Second check: against campus anchors list
    if (campusAnchors.length > 0 && location) {
      const isAnchor = campusAnchors.some(anchor => {
        if (locationId && anchor.locationId) return locationId === anchor.locationId;
        if (locationId && anchor.id) return locationId === anchor.id;
        if (location.latitude && location.longitude && anchor.latitude && anchor.longitude) {
          const distance = Math.sqrt(
            Math.pow(location.latitude - anchor.latitude, 2) + 
            Math.pow(location.longitude - anchor.longitude, 2)
          );
          return distance < 0.001;
        }
        const anchorName = (anchor.name || anchor.address || '').toLowerCase().trim();
        return locationName && locationName === anchorName;
      });
      
      if (isAnchor) return true;
    }
    
    // Third check: by coordinates
    if (location?.latitude && location?.longitude) {
      if (Math.abs(location.latitude - 10.841480) < 0.001 && 
          Math.abs(location.longitude - 106.809844) < 0.001) {
        return true;
      }
      if (Math.abs(location.latitude - 10.8753395) < 0.001 && 
          Math.abs(location.longitude - 106.8000331) < 0.001) {
        return true;
      }
    }
    
    return false;
  };

  useEffect(() => {
    initializeLocation();
    // Initialize scheduled time
    applySchedule(datePart, timePart);
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

      const locationData = nearbyPOI ? {
        id: nearbyPOI.locationId,
        locationId: nearbyPOI.locationId,
        latitude: nearbyPOI.latitude,
        longitude: nearbyPOI.longitude,
        name: nearbyPOI.name,
        address: nearbyPOI.name,
        isPOI: true
      } : {
        latitude: latitude,
        longitude: longitude,
        address: addressText,
        isPOI: false
      };

      if (isSelectingStart) {
        setStartLocation(locationData);
        setStartAddress(nearbyPOI ? nearbyPOI.name : addressText);
        setIsSelectingStart(false);
        
        const mapStartAddress = nearbyPOI ? nearbyPOI.name : addressText;
        const isAnchor = isCampusAnchor(locationData, mapStartAddress);
        setStartIsCampusAnchor(isAnchor);
        
        if (!isAnchor && fptUniversityLocation && !endLocation) {
          setEndLocation(fptUniversityLocation);
          setEndAddress(fptUniversityLocation.name || fptUniversityLocation.address);
          setEndIsCampusAnchor(true);
        }
      } else if (isSelectingEnd) {
        if (!startIsCampusAnchor) {
          Alert.alert('Thông báo', 'Vui lòng chọn điểm đến từ danh sách điểm mốc');
          setIsSelectingEnd(false);
          return;
        }
        
        setEndLocation(locationData);
        setEndAddress(nearbyPOI ? nearbyPOI.name : addressText);
        setIsSelectingEnd(false);
        
        const mapEndAddress = nearbyPOI ? nearbyPOI.name : addressText;
        const isAnchor = isCampusAnchor(locationData, mapEndAddress);
        setEndIsCampusAnchor(isAnchor);
      }
    } catch (error) {
      console.error('Error handling map press:', error);
      Alert.alert('Lỗi', 'Không thể xác định địa chỉ cho vị trí này');
    }
  };
  */

  const centerMapToLocation = (location) => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion(
        locationService.getMapRegion(location.latitude, location.longitude),
        1000
      );
    }
  };

  const fitMapToMarkers = () => {
    if (mapRef.current && startLocation && endLocation) {
      mapRef.current.fitToCoordinates(
        [startLocation, endLocation],
        { edgePadding: 50 }
      );
    }
  };


  function combineVNDateTime(dPart, tPart) {
    const y = dPart.getFullYear();
    const m = dPart.getMonth();      // 0..11
    const d = dPart.getDate();
    const hh = tPart.getHours();
    const mm = tPart.getMinutes();
    const ss = 0;
  
    // Tạo Date object với giờ VN
    const resultDate = new Date(y, m, d, hh, mm, ss);
  
    // Tạo ISO string không có timezone (backend expect format: 2025-10-05T08:00:00)
    const pad = (n) => String(n).padStart(2, '0');
    const isoLocal = `${y}-${pad(m + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  
    return { date: resultDate, isoVN: isoLocal };
  }
  
  // Gom lại và cập nhật 2 state: scheduledTime (Date) & scheduledTimeIsoVN (string)
  function applySchedule(dPart, tPart) {
    const { date, isoVN } = combineVNDateTime(dPart, tPart);
    setScheduledTime(date);
    setScheduledTimeIsoVN(isoVN);
  }

  // Helper function to format Date object to backend expected format
  function formatDateTimeForBackend(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  const handleRouteSelect = (route) => {
    if (!route) return;

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

      /*
      // If startLocation is null, try to geocode the address (only in custom mode)
      if (bookingMode === 'custom' && !processedStartLocation && startAddress.trim()) {
        console.log("🔍 Geocoding start address:", startAddress);
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
            console.log("✅ Start location geocoded:", processedStartLocation);
          }
        } catch (error) {
          console.error("❌ Failed to geocode start address:", error);
        }
      }

      // If endLocation is null, try to geocode the address (only in custom mode)
      if (bookingMode === 'custom' && !processedEndLocation && endAddress.trim()) {
        console.log("🔍 Geocoding end address:", endAddress);
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
            console.log("✅ End location geocoded:", processedEndLocation);
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
      
      // Only include scheduledDepartureTime if hasScheduledTime is true
      if (hasScheduledTime) {
        rideData.scheduledDepartureTime = scheduledTimeIsoVN || formatDateTimeForBackend(scheduledTime);
      }

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

      console.log("Creating shared ride with data:", rideData);
      const result = await rideService.createSharedRide(rideData);
      const createdRideId =
        result?.shared_ride_id ||
        result?.sharedRideId ||
        result?.rideId ||
        result?.id;

      Alert.alert("Thành công!", "Đã tạo chuyến đi chia sẻ", [
        {
          text: "Xem chi tiết",
          onPress: () => {
            if (createdRideId) {
              navigation.replace("DriverRideDetails", {
                rideId: createdRideId,
                ride: result,
              });
            } else {
              navigation.goBack();
            }
          },
        },
      ]);
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
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.container}>
          <SoftBackHeader
            title="Tạo chuyến chia sẻ"
            onBackPress={() => navigation.goBack()}
          />

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

        {/* Control Buttons disabled */}
        {false && (
        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => centerMapToLocation(currentLocation)}
          >
            <Icon name="my-location" size={24} color="#4CAF50" />
          </TouchableOpacity>
          
          {startLocation && endLocation && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={fitMapToMarkers}
            >
              <Icon name="zoom-out-map" size={24} color="#4CAF50" />
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Bottom Panel */}
        <Animatable.View 
          animation="slideInUp" 
          style={styles.bottomPanel}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
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

            {/* Route Selector */}
              <View style={styles.routeSelector}>
                {loadingRoutes ? (
                  <View style={styles.loadingRoutesContainer}>
                    <ActivityIndicator size="small" color="#4CAF50" style={{ marginRight: 10 }} />
                    <Text style={styles.loadingRoutesText}>Đang tải tuyến đường...</Text>
                  </View>
                ) : templateRoutes.length === 0 ? (
                  <View style={styles.emptyRoutesContainer}>
                    <Icon name="route" size={40} color="#ccc" />
                    <Text style={styles.emptyRoutesText}>Không có tuyến đường nào</Text>
                  </View>
                ) : (
                  <ScrollView 
                    style={styles.routesList}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                  >
                    {templateRoutes.map((route) => (
                      <TouchableOpacity
                        key={route.routeId}
                        style={[
                          styles.routeCard,
                          selectedRoute?.routeId === route.routeId && styles.routeCardSelected
                        ]}
                        onPress={() => handleRouteSelect(route)}
                      >
                        <View style={styles.routeCardContent}>
                          <View style={styles.routeCardHeader}>
                            <Icon 
                              name="route" 
                              size={20} 
                              color={selectedRoute?.routeId === route.routeId ? '#4CAF50' : '#666'} 
                              style={{ marginRight: 8 }}
                            />
                            <Text style={[
                              styles.routeCardName,
                              selectedRoute?.routeId === route.routeId && styles.routeCardNameSelected
                            ]}>
                              {route.name}
                            </Text>
                          </View>
                          
                          <View style={styles.routeCardLocations}>
                            <View style={styles.routeLocationItem}>
                              <Icon name="radio-button-checked" size={14} color="#4CAF50" style={{ marginRight: 8 }} />
                              <Text style={styles.routeLocationText} numberOfLines={1}>
                                {route.fromLocationName || 'Điểm đi'}
                              </Text>
                            </View>
                            <View style={styles.routeLocationItem}>
                              <Icon name="location-on" size={14} color="#F44336" style={{ marginRight: 8 }} />
                              <Text style={styles.routeLocationText} numberOfLines={1}>
                                {route.toLocationName || 'Điểm đến'}
                              </Text>
                            </View>
                          </View>
                          
                          {route.defaultPrice != null && (
                            <View style={styles.routeCardPrice}>
                              <Text style={styles.routePriceText}>
                                ~{route.defaultPrice.toLocaleString('vi-VN')} đ
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        {selectedRoute?.routeId === route.routeId && (
                          <View style={styles.routeCardCheck}>
                            <Icon name="check-circle" size={24} color="#4CAF50" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

            {/* Location Inputs - Custom Mode (disabled) */}
            {/*
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tuyến đường</Text>

                <AddressInput
                value={startAddress}
                onChangeText={setStartAddress}
                onLocationSelect={(location) => {
                  setStartLocation(location);
                  setStartAddress(location.address || location.name);
                  
                  const addressText = location.address || location.name || startAddress;
                  const isAnchor = isCampusAnchor(location, addressText);
                  setStartIsCampusAnchor(isAnchor);
                  
                  if (!isAnchor && fptUniversityLocation && !endLocation) {
                    setEndLocation(fptUniversityLocation);
                    setEndAddress(fptUniversityLocation.name || fptUniversityLocation.address);
                    setEndIsCampusAnchor(true);
                  }
                }}
                placeholder="Chọn điểm đi"
                iconName="radio-button-checked"
                iconColor="#4CAF50"
                style={styles.addressInput}
                isPickupInput={true}
                currentLocation={currentLocation}
              />

              {/* Start location selection button */}
              {/* <TouchableOpacity 
                style={styles.mapSelectionButton}
                onPress={() => setIsSelectingStart(true)}
              >
                <Icon name="my-location" size={16} color="#4CAF50" />
                <Text style={styles.mapSelectionText}>Chọn trên bản đồ</Text>
              </TouchableOpacity>

              <View style={styles.locationDivider}>
                <View style={styles.dividerLine} />
                <Icon name="more-vert" size={16} color="#ccc" />
                <View style={styles.dividerLine} />
              </View> */}

              {/* Show AddressInput for end if start is a campus anchor, otherwise show CampusAnchorPicker */}
              {/*{startIsCampusAnchor ? (
                <>
                  <AddressInput
                    value={endAddress}
                    onChangeText={setEndAddress}
                    onLocationSelect={(location) => {
                      const addressText = location.address || location.name;
                      setEndLocation(location);
                      setEndAddress(addressText);
                      setEndIsCampusAnchor(isCampusAnchor(location, addressText));
                    }}
                    placeholder="Chọn điểm đến"
                    iconName="location-on"
                    iconColor="#F44336"
                    style={styles.addressInput}
                  />
                  
                  {/* End location selection button */}
                  {/*<TouchableOpacity 
                    style={styles.mapSelectionButton}
                    onPress={() => setIsSelectingEnd(true)}
                  >
                    <Icon name="my-location" size={16} color="#F44336" />
                    <Text style={styles.mapSelectionText}>Chọn trên bản đồ</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <CampusAnchorPicker
                    value={endAddress}
                    onLocationSelect={(location) => {
                      setEndLocation(location);
                      setEndAddress(location.name || location.address);
                      setEndIsCampusAnchor(true);
                    }}
                    placeholder="Chọn điểm đến (phải là điểm mốc)"
                    iconName="location-on"
                    iconColor="#F44336"
                    style={styles.addressInput}
                    options={campusAnchors}
                  />
                </>
              )}

              {/* Info text */}
              {/*<View style={styles.infoContainer}>
                <Icon name="info" size={14} color="#666" />
                <Text style={styles.infoText}>
                  {startIsCampusAnchor 
                    ? 'Điểm đi là điểm mốc, bạn có thể chọn điểm đến tự do'
                    : endIsCampusAnchor
                    ? 'Điểm đến là điểm mốc, bạn có thể chọn điểm đi tự do'
                    : 'Điểm đến phải là FPT University hoặc Nhà Văn Hóa Sinh Viên'}
                </Text>
              </View>*/}
             
      

            {/* Schedule */}
            <View style={styles.section}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.sectionTitle}>Thời gian khởi hành</Text>
                <Switch
                  value={hasScheduledTime}
                  onValueChange={setHasScheduledTime}
                  trackColor={{ false: '#E0E0E0', true: '#C8E6C9' }}
                  thumbColor={hasScheduledTime ? '#4CAF50' : '#9E9E9E'}
                />
              </View>
              
              {hasScheduledTime ? (
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="schedule" size={20} color="#2196F3" />
                  <Text style={styles.dateTimeText}>
                    {scheduledTime.toLocaleString("vi-VN")}
                  </Text>
                  <Icon name="keyboard-arrow-right" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={styles.scheduleNote}>
                  <Icon name="info" size={16} color="#666" />
                  <Text style={styles.scheduleNoteText}>
                    Nếu thời gian khởi hành không được chỉ định thì chuyến xe khi được chia sẻ sẽ bắt đầu ngay lập tức
                  </Text>
                </View>
              )}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, loading && styles.disabledButton]}
              onPress={handleCreateRide}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="add" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Tạo chuyến đi</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animatable.View>

        {/* Date Time Picker */}
        {showDatePicker && (
  <DateTimePicker
    value={datePart}
    mode="date"
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    // chỉ Android mới có event.type; iOS event có thể undefined
    onChange={(event, selectedDate) => {
      // đóng picker trên mọi nền tảng khi user đã chọn hoặc cancel
      if (Platform.OS === 'android') setShowDatePicker(false);
      if (event?.type === 'dismissed') {
        if (Platform.OS === 'ios') setShowDatePicker(false);
        return;
      }
      if (selectedDate) {
        const next = new Date(selectedDate);
        next.setHours(0, 0, 0, 0); // chỉ giữ Y-M-D
        setDatePart(next);
        // Cập nhật preview ngay (giữ HH:mm cũ)
        applySchedule(next, timePart);
        // đóng date picker và mở time picker
        setShowDatePicker(false);
        // dùng setTimeout 0 để tránh batch state làm kẹt modal trên iOS
        setTimeout(() => setShowTimePicker(true), 0);
      }
    }}
    
    minimumDate={new Date()} // không cho chọn ngày quá khứ
  />
)}

{/* Time Picker */}
{showTimePicker && (
  <DateTimePicker
    value={timePart}
    mode="time"
    is24Hour={true}
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={(event, selectedTime) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
        if (event?.type === 'dismissed') return;
      }
      if (selectedTime) {
        // Chỉ lấy HH:mm; giữ nguyên datePart
        const next = new Date(timePart);
        next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        setTimePart(next);
        applySchedule(datePart, next);
      }
    }}
  />
)}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AppBackground>
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
