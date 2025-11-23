import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton';
import CleanCard from '../../components/ui/CleanCard';
import { colors } from '../../theme/designTokens';
import rideService from '../../services/rideService';

const DriverCompletionScreen = ({ navigation, route }) => {
  const { completionData } = route.params || {};
  
  const sharedRideId = completionData?.shared_ride_id || completionData?.sharedRideId || completionData?.rideId;
  const sharedRideRequestId = completionData?.shared_ride_request_id || completionData?.sharedRideRequestId || completionData?.requestId;
  const actualDistance = completionData?.actual_distance || completionData?.actualDistance || 0;
  const actualDuration = completionData?.actual_duration || completionData?.actualDuration || 0;
  
  // Handle driverEarnings - could be number, string (BigDecimal), or object with amount
  let driverEarnings = completionData?.driver_earnings || completionData?.driverEarnings || 0;
  if (typeof driverEarnings === 'object' && driverEarnings !== null && driverEarnings.amount !== undefined) {
    driverEarnings = driverEarnings.amount;
  }
  if (typeof driverEarnings === 'string') {
    driverEarnings = parseFloat(driverEarnings) || 0;
  }
  
  const completedAt = completionData?.completed_at || completionData?.completedAt;

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateTimeString;
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 phút';
    if (minutes < 60) {
      return `${Math.round(minutes)} phút`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  };

  const handleDone = () => {
    navigation.navigate('DriverHome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hoàn thành chuyến đi</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Success Icon */}
        <Animatable.View animation="fadeInUp" duration={400} useNativeDriver>
          <View style={styles.successIconContainer}>
            <View style={styles.successIcon}>
              <Icon name="check-circle" size={80} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Chuyến đi hoàn thành!</Text>
            <Text style={styles.successSubtitle}>
              Cảm ơn bạn đã hoàn thành chuyến đi một cách an toàn.
            </Text>
          </View>
        </Animatable.View>

        {/* Summary Card */}
        <Animatable.View animation="fadeInUp" duration={400} delay={100} useNativeDriver>
          <CleanCard style={styles.summaryCard} contentStyle={styles.summaryContent}>
            <Text style={styles.sectionTitle}>Tóm tắt chuyến đi</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Icon name="route" size={20} color={colors.textSecondary} />
                <View style={styles.summaryItemContent}>
                  <Text style={styles.summaryLabel}>Quãng đường</Text>
                  <Text style={styles.summaryValue}>
                    {actualDistance ? `${actualDistance.toFixed(1)} km` : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Icon name="access-time" size={20} color={colors.textSecondary} />
                <View style={styles.summaryItemContent}>
                  <Text style={styles.summaryLabel}>Thời gian</Text>
                  <Text style={styles.summaryValue}>
                    {formatDuration(actualDuration)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Icon name="event" size={20} color={colors.textSecondary} />
                <View style={styles.summaryItemContent}>
                  <Text style={styles.summaryLabel}>Hoàn thành lúc</Text>
                  <Text style={styles.summaryValue}>
                    {formatDateTime(completedAt)}
                  </Text>
                </View>
              </View>
            </View>
          </CleanCard>
        </Animatable.View>

        {/* Earnings Card */}
        <Animatable.View animation="fadeInUp" duration={400} delay={200} useNativeDriver>
          <CleanCard style={styles.earningsCard} contentStyle={styles.earningsContent}>
            <View style={styles.earningsHeader}>
              <Icon name="account-balance-wallet" size={32} color={colors.primary} />
              <View style={styles.earningsHeaderText}>
                <Text style={styles.earningsLabel}>Thu nhập</Text>
                <Text style={styles.earningsValue}>
                  {rideService.formatCurrency(driverEarnings)}
                </Text>
              </View>
            </View>
            <Text style={styles.earningsNote}>
              Số tiền này đã được cộng vào ví của bạn sau khi trừ hoa hồng.
            </Text>
          </CleanCard>
        </Animatable.View>

        {/* Ride Details Card */}
        {(sharedRideId || sharedRideRequestId) && (
          <Animatable.View animation="fadeInUp" duration={400} delay={300} useNativeDriver>
            <CleanCard style={styles.detailsCard} contentStyle={styles.detailsContent}>
              <Text style={styles.sectionTitle}>Thông tin chuyến đi</Text>
              
              {sharedRideId && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mã chuyến đi:</Text>
                  <Text style={styles.detailValue}>#{sharedRideId}</Text>
                </View>
              )}
              
              {sharedRideRequestId && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mã yêu cầu:</Text>
                  <Text style={styles.detailValue}>#{sharedRideRequestId}</Text>
                </View>
              )}
            </CleanCard>
          </Animatable.View>
        )}

        {/* Done Button */}
        <View style={styles.buttonContainer}>
          <ModernButton
            title="Hoàn tất"
            icon="check"
            onPress={handleDone}
            size="large"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 34,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  summaryRow: {
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryItemContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  earningsCard: {
    marginBottom: 20,
    backgroundColor: 'rgba(16,65,47,0.05)',
  },
  earningsContent: {
    padding: 20,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  earningsHeaderText: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  earningsNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  detailsCard: {
    marginBottom: 20,
  },
  detailsContent: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonContainer: {
    marginTop: 20,
  },
});

export default DriverCompletionScreen;

