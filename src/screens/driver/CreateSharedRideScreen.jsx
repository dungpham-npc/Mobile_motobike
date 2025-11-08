import React, { useState, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import DateTimePicker from "@react-native-community/datetimepicker";

import rideService from "../../services/rideService";
import poiService from "../../services/poiService";
import authService from "../../services/authService";
import vehicleService from "../../services/vehicleService";
import SimpleAddressInput from "../../components/SimpleAddressInput";
import locationService from "../../services/LocationService";
import goongService from "../../services/goongService";

const CreateSharedRideScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Location states
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");

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

  useEffect(() => {
    loadVehicles();
    getCurrentLocation();
    // Initialize scheduled time
    applySchedule(datePart, timePart);
  }, []);

  const getCurrentLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error("Error getting current location:", error);
    }
  };

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true);

      const response = await vehicleService.getDriverVehicles({
        page: 0,
        size: 50, // Get all vehicles for the driver
        sortBy: "createdAt",
        sortDir: "desc",
      });

      if (response && response.data) {
        const formattedVehicles = vehicleService.formatVehicles(response.data);
        setVehicles(formattedVehicles);
      } else {
        setVehicles([]);
        console.log("No vehicles found for driver");
      }
    } catch (error) {
      console.error("Error loading vehicles:", error);
      setVehicles([]);

      // Show user-friendly error message
      let errorMessage = "Không thể tải danh sách phương tiện";
      if (error.message?.includes("Driver profile not found")) {
        errorMessage = "Không tìm thấy hồ sơ tài xế. Vui lòng đăng nhập lại.";
      } else if (error.status === 404) {
        errorMessage =
          "Bạn chưa đăng ký phương tiện nào. Vui lòng thêm phương tiện trước.";
      }

      Alert.alert("Lỗi", errorMessage, [
        { text: "OK" },
        {
          text: "Thêm phương tiện",
          onPress: () => {
            // TODO: Navigate to add vehicle screen
            console.log("Navigate to add vehicle screen");
          },
        },
      ]);
    } finally {
      setLoadingVehicles(false);
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

  const handleCreateRide = async () => {

    // Validation
    if (!vehicles || vehicles.length === 0) {
      Alert.alert("Lỗi", "Không có phương tiện nào để tạo chuyến đi");
      return;
    }
    if (!startAddress.trim() || !endAddress.trim()) {
      Alert.alert("Lỗi", "Vui lòng chọn điểm đi và điểm đến");
      return;
    }

    // Handle manual address input (geocode if location is null)
    let processedStartLocation = startLocation;
    let processedEndLocation = endLocation;

    try {
      setLoading(true);

      // If startLocation is null, try to geocode the address
      if (!processedStartLocation && startAddress.trim()) {
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

      // If endLocation is null, try to geocode the address
      if (!processedEndLocation && endAddress.trim()) {
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

      // Final validation
      if (!processedStartLocation || !processedEndLocation) {
        Alert.alert(
          "Lỗi",
          "Không thể xác định tọa độ cho địa chỉ đã nhập. Vui lòng chọn từ danh sách gợi ý hoặc nhập địa chỉ chính xác hơn."
        );
        return;
      }

      // Prepare request body to match expected format
      const rideData = {
        scheduledDepartureTime: scheduledTimeIsoVN || formatDateTimeForBackend(scheduledTime),
      };

      // Add location data based on whether it's POI or coordinates
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

      console.log("Creating shared ride with data:", rideData);
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
              // Reset to default time (5 minutes from now)
              const defaultTime = new Date();
              defaultTime.setMinutes(defaultTime.getMinutes() + 5);
              defaultTime.setSeconds(0);
              defaultTime.setMilliseconds(0);
              setTimePart(defaultTime);
              applySchedule(datePart, defaultTime);
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

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* Vehicle Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phương tiện</Text>
            {loadingVehicles ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.loadingText}>Đang tải phương tiện...</Text>
              </View>
            ) : vehicles.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="warning" size={24} color="#FF9800" />
                <Text style={styles.emptyText}>Không có phương tiện nào</Text>
                <TouchableOpacity
                  style={styles.addVehicleButton}
                  onPress={() => {
                    // TODO: Navigate to add vehicle screen
                    Alert.alert(
                      "Thông báo",
                      "Chức năng thêm phương tiện sẽ được cập nhật sớm"
                    );
                  }}
                >
                  <Text style={styles.addVehicleText}>Thêm phương tiện</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.vehicleCard}
                onPress={() => {
                  // TODO: Show vehicle selection modal
                  Alert.alert(
                    "Chọn phương tiện",
                    "Chức năng chọn phương tiện sẽ được cập nhật sớm"
                  );
                }}
              >
                <Icon name="motorcycle" size={24} color="#4CAF50" />
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleName}>
                    {vehicles[0]?.displayName || vehicles[0]?.model}
                  </Text>
                  <Text style={styles.vehiclePlate}>
                    {vehicles[0]?.plateNumber}
                  </Text>
                  <Text style={styles.vehicleStatus}>
                    {vehicles[0]?.isVerified
                      ? "✓ Đã xác minh"
                      : "⚠ Chưa xác minh"}
                  </Text>
                </View>
                <Icon name="keyboard-arrow-right" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Route Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tuyến đường</Text>

            <SimpleAddressInput
              value={startAddress}
              onChangeText={setStartAddress}
              onLocationSelect={(location) => {
                setStartLocation(location);
                setStartAddress(location.address);
              }}
              placeholder="Chọn điểm đi"
              iconName="my-location"
              iconColor="#4CAF50"
              style={styles.addressInput}
              isPickupInput={true}
              currentLocation={currentLocation}
            />

            <View style={styles.locationDivider}>
              <View style={styles.dividerLine} />
              <Icon name="more-vert" size={16} color="#ccc" />
              <View style={styles.dividerLine} />
            </View>

            <SimpleAddressInput
              value={endAddress}
              onChangeText={setEndAddress}
              onLocationSelect={(location) => {
                setEndLocation(location);
                setEndAddress(location.address);
              }}
              placeholder="Chọn điểm đến"
              iconName="place"
              iconColor="#F44336"
              style={styles.addressInput}
            />
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
  vehicleCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  vehiclePlate: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  vehicleStatus: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
    marginBottom: 12,
  },
  addVehicleButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addVehicleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  addressInput: {
    marginBottom: 5,
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
});

export default CreateSharedRideScreen;
