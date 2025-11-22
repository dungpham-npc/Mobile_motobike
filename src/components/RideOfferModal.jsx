import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";

import rideService from "../services/rideService";
import locationService from "../services/LocationService";

const { width, height } = Dimensions.get("window");

const sanitizeLocationText = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") {
    return null;
  }
  return trimmed;
};

const RideOfferModal = ({
  visible,
  offer,
  countdown,
  onAccept,
  onReject,
  onClose,
  vehicleId,
  navigation,
  currentLocation
}) => {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCurrency = (amount) => {
    if (!amount) return "0đ";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;

    const distance = locationService.calculateDistance(lat1, lng1, lat2, lng2);
    return locationService.formatDistance(distance);
  };

  const getLocationDisplay = (primary, secondary) => {
    return sanitizeLocationText(primary) || sanitizeLocationText(secondary) || "Đang xác định";
  };

  const handleAccept = async () => {
    try {
      setAccepting(true);

      let response;
      
      // Check if this is a broadcast request
      if (offer.broadcast === true) {
        response = await rideService.acceptBroadcastRequest(
          offer.requestId,
          vehicleId,
          currentLocation
        );
      } else {
        response = await rideService.acceptRideRequest(
          offer.requestId,
          offer.rideId,
          currentLocation
        );
      }


      Alert.alert(
        "Thành công!",
        "Bạn đã nhận chuyến đi thành công. Hãy chuẩn bị đón khách.",
        [
          {
            text: "Bắt đầu chuyến đi",
            onPress: () => {
              onAccept(); // Close modal
              if (navigation && response.shared_ride_id) {
                navigation.navigate('DriverRideTracking', {
                  rideId: response.shared_ride_id,
                  startTracking: true,
                  rideData: response,
                  status: 'SCHEDULED'
                });
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("❌ Accept ride error:", error);

      let errorMessage = "Không thể nhận chuyến đi. Vui lòng thử lại.";
      if (
        error.message?.includes("expired") ||
        error.message?.includes("no longer available")
      ) {
        errorMessage = "Yêu cầu đã hết hạn hoặc không còn khả dụng.";
      }

      Alert.alert("Lỗi", errorMessage);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async (reason = "Driver declined") => {
    try {
      setRejecting(true);

      // Call backend API to reject the ride request
      await rideService.rejectRideRequest(offer.requestId, reason);

      onReject(reason);
    } catch (error) {
      console.error("Reject ride error:", error);
      // Still close the modal even if reject API fails
      onReject(reason);
    } finally {
      setRejecting(false);
    }
  };

  const showRejectOptions = () => {
    Alert.alert("Từ chối chuyến đi", "Vui lòng chọn lý do:", [
      {
        text: "Quá xa",
        onPress: () => handleReject("Too far from pickup location"),
      },
      {
        text: "Bận việc khác",
        onPress: () => handleReject("Driver is busy with other tasks"),
      },
      {
        text: "Không phù hợp",
        onPress: () => handleReject("Route not suitable"),
      },
      {
        text: "Hủy",
        style: "cancel",
      },
    ]);
  };

  if (!offer) {
    return null;
  }

  const hasDeadline = Boolean(offer.offerExpiresAt);
  const safeCountdown = hasDeadline ? Math.max(countdown, 0) : null;
  const isExpired = hasDeadline && safeCountdown <= 0;
  const isUrgent = hasDeadline && safeCountdown !== null && safeCountdown <= 10;
  const isBroadcastRequest =
    offer.broadcast === true ||
    offer?.status === "BROADCASTING" ||
    offer?.requestStatus === "BROADCASTING";

  const routeDistanceDisplay = (() => {
    const text = formatDistance(
      offer.pickupLat,
      offer.pickupLng,
      offer.dropoffLat,
      offer.dropoffLng
    );
    return text || "Khoảng cách đang cập nhật";
  })();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animatable.View
          animation="slideInUp"
          duration={300}
          style={styles.modalContainer}
        >
          {/* Header */}
          <LinearGradient
            colors={
              isExpired ? ["#F44336", "#D32F2F"] : ["#4CAF50", "#2E7D32"]
            }
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Icon name="directions-car" size={24} color="#fff" />
                <Text style={styles.headerTitle}>
                  {offer.proposalRank === 1
                    ? "Yêu cầu tham gia"
                    : "Chuyến đi mới"}
                </Text>
              </View>

              {hasDeadline && (
                <View style={styles.timerContainer}>
                  <Icon name="timer" size={20} color="#fff" />
                  <Text
                    style={[styles.timerText, isUrgent && styles.urgentTimer]}
                  >
                    {formatTime(safeCountdown)}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {/* Rider Info */}
            <View style={styles.riderInfo}>
              <View style={styles.riderAvatar}>
                <Icon name="person" size={24} color="#4CAF50" />
              </View>
              <View style={styles.riderDetails}>
                <Text style={styles.riderName}>{offer.riderName}</Text>
              </View>
              <View style={styles.fareContainer}>
                <Text style={styles.fareAmount}>
                  {formatCurrency(
                    offer.fareAmount ?? offer.totalFare ?? offer.fare?.total ?? 0
                  )}
                </Text>
              </View>
            </View>

            {/* Route Info */}
            <View style={styles.routeContainer}>
              {/* Pickup */}
              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <View style={[styles.dot, styles.pickupDot]} />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Điểm đón</Text>
                  <Text style={styles.locationName}>
                    {getLocationDisplay(offer.pickupLocationName, offer.pickupAddress)}
                  </Text>
                  {offer.pickupTime && (
                    <Text style={styles.locationTime}>
                      {new Date(offer.pickupTime).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Route Line */}
              <View style={styles.routeLine}>
                <View style={styles.routeDash} />
                <Text style={styles.routeDistance}>
                  {routeDistanceDisplay}
                </Text>
              </View>

              {/* Dropoff */}
              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <View style={[styles.dot, styles.dropoffDot]} />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Điểm đến</Text>
                  <Text style={styles.locationName}>
                    {getLocationDisplay(offer.dropoffLocationName, offer.dropoffAddress)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Match Score */}
            {offer.matchScore && (
              <View style={styles.matchScoreContainer}>
                <Icon name="trending-up" size={16} color="#4CAF50" />
                  <Text style={styles.matchScoreText}>
                    Độ phù hợp: {Math.round(offer.matchScore)}%
                  </Text>
              </View>
            )}

            {/* Proposal Rank */}
            {/* {offer.proposalRank > 1 && (
              <View style={styles.rankContainer}>
                <Icon name="info" size={16} color="#FF9800" />
                <Text style={styles.rankText}>
                  Bạn là lựa chọn thứ {offer.proposalRank}
                </Text>
              </View>
            )} */}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {!isBroadcastRequest && (
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={showRejectOptions}
                disabled={accepting || rejecting || isExpired}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="close" size={20} color="#fff" />
                    <Text style={styles.rejectButtonText}>Từ chối</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.acceptButton,
                isExpired && styles.disabledButton,
              ]}
              onPress={handleAccept}
              disabled={accepting || rejecting || isExpired}
            >
              {accepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={20} color="#fff" />
                  <Text style={styles.acceptButtonText}>
                    {isExpired ? "Hết hạn" : "Nhận chuyến"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animatable.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 8,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timerText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 4,
  },
  urgentTimer: {
    color: "#FFEB3B",
  },
  content: {
    padding: 20,
  },
  riderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  riderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  riderRating: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  fareContainer: {
    alignItems: "flex-end",
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  fareLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  routeContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  locationIcon: {
    width: 20,
    alignItems: "center",
    marginRight: 12,
    marginTop: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pickupDot: {
    backgroundColor: "#4CAF50",
  },
  dropoffDot: {
    backgroundColor: "#F44336",
  },
  locationInfo: {
    flex: 1,
    marginBottom: 16,
  },
  locationLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  locationName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  locationTime: {
    fontSize: 12,
    color: "#4CAF50",
    marginTop: 2,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
    marginBottom: 8,
  },
  routeDash: {
    width: 2,
    height: 20,
    backgroundColor: "#ddd",
    marginRight: 12,
  },
  routeDistance: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  matchScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  matchScoreText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
    marginLeft: 4,
  },
  rankContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rankText: {
    fontSize: 14,
    color: "#FF9800",
    fontWeight: "500",
    marginLeft: 4,
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 0,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  rejectButton: {
    backgroundColor: "#F44336",
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
  },
  disabledButton: {
    backgroundColor: "#9E9E9E",
  },
  rejectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
});

export default RideOfferModal;
