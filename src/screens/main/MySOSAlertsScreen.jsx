import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import SOSButton from '../../components/SOSButton';
import sosService from '../../services/sosService';

const MySOSAlertsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [hasActiveAlert, setHasActiveAlert] = useState(false);

  const filterOptions = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Đang hoạt động', value: 'ACTIVE' },
    { label: 'Đã báo cáo', value: 'ESCALATED' },
    { label: 'Đã xác nhận', value: 'ACKNOWLEDGED' },
    { label: 'Đã giải quyết', value: 'RESOLVED' },
    { label: 'Báo động giả', value: 'FALSE_ALARM' },
  ];

  const loadAlerts = async () => {
    try {
      const statuses = selectedFilter === 'ALL' ? null : [selectedFilter];
      console.log('📱 MySOSAlertsScreen - selectedFilter:', selectedFilter);
      console.log('📱 MySOSAlertsScreen - statuses to send:', statuses);
      const response = await sosService.getMyAlerts(statuses);
      console.log('📱 MySOSAlertsScreen - received alerts:', response?.length || 0);
      console.log('📱 MySOSAlertsScreen - alerts data:', JSON.stringify(response, null, 2));
      setAlerts(response || []);
      setHasActiveAlert(response?.some(alert => 
        alert.status === 'ACTIVE' || alert.status === 'ESCALATED'
      ));
    } catch (error) {
      console.error('Failed to load SOS alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [selectedFilter]);

  // Auto-refresh: 10s nếu có active alert, 30s nếu không
  useEffect(() => {
    const interval = setInterval(() => {
      loadAlerts();
    }, hasActiveAlert ? 10000 : 30000);

    return () => clearInterval(interval);
  }, [hasActiveAlert, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [selectedFilter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const handleTriggerSOS = async () => {
    try {
      await sosService.triggerAlert({
        role: 'rider',
        description: 'SOS được kích hoạt từ màn hình cảnh báo',
      });
      loadAlerts();
    } catch (error) {
      console.error('Failed to trigger SOS:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
      case 'ESCALATED':
        return '#EF4444';
      case 'ACKNOWLEDGED':
        return '#3B82F6';
      case 'RESOLVED':
        return '#10B981';
      case 'FALSE_ALARM':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'Đang hoạt động';
      case 'ESCALATED':
        return 'Đã báo cáo';
      case 'ACKNOWLEDGED':
        return 'Đã xác nhận';
      case 'RESOLVED':
        return 'Đã giải quyết';
      case 'FALSE_ALARM':
        return 'Báo động giả';
      default:
        return status;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString(); // giữ nguyên ISO, không convert múi giờ
  };

  const formatDescription = (text) => {
    if (!text) return '';
    const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;
    return text.replace(isoPattern, (match) => {
      const d = new Date(match);
      return d.toLocaleString();
    });
  };

  const renderAlertCard = (alert, index) => (
    <Animatable.View
      key={alert.sosId}
      animation="fadeInUp"
      delay={index * 100}
      style={styles.alertCard}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('SOSAlertDetail', { alertId: alert.sosId })}
        activeOpacity={0.7}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertTitleRow}>
            <Icon
              name="warning"
              size={20}
              color={getStatusColor(alert.status)}
              style={styles.alertIcon}
            />
            <Text style={styles.alertId}>Cảnh báo SOS #{alert.sosId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(alert.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(alert.status)}</Text>
          </View>
        </View>

        {alert.escalationCount > 0 && (
          <View style={styles.escalationBadge}>
            <Icon name="arrow-upward" size={14} color="#F59E0B" />
            <Text style={styles.escalationText}>
              Đã escalation {alert.escalationCount} lần
            </Text>
          </View>
        )}

        <View style={styles.alertInfo}>
          <View style={styles.infoRow}>
            <Icon name="access-time" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{formatDateTime(alert.createdAt)}</Text>
          </View>

          {alert.description && (
            <View style={styles.infoRow}>
              <Icon name="description" size={16} color="#6B7280" />
              <Text style={styles.infoText} numberOfLines={2}>
                {formatDescription(alert.description)}
              </Text>
            </View>
          )}

          {alert.currentLat && alert.currentLng && (
            <View style={styles.infoRow}>
              <Icon name="location-on" size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {alert.currentLat.toFixed(6)}, {alert.currentLng.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.alertFooter}>
          <Text style={styles.viewDetailsText}>Xem chi tiết</Text>
          <Icon name="chevron-right" size={20} color="#3B82F6" />
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SoftBackHeader title="Cảnh báo SOS của tôi" onBackPress={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Description */}
        <Animatable.View animation="fadeInDown" style={styles.descriptionCard}>
          <Icon name="info-outline" size={20} color="#3B82F6" />
          <Text style={styles.descriptionText}>
            Quản lý và theo dõi các cảnh báo khẩn cấp của bạn
          </Text>
        </Animatable.View>

        {/* Filter */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  selectedFilter === option.value && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(option.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === option.value && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Alerts List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Đang tải cảnh báo...</Text>
          </View>
        ) : alerts.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyState}>
            <Icon name="check-circle" size={80} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Không có cảnh báo SOS</Text>
            <Text style={styles.emptyDescription}>
              Bạn chưa có cảnh báo SOS nào. Hy vọng bạn không cần sử dụng tính năng này.
            </Text>
          </Animatable.View>
        ) : (
          <View style={styles.alertsList}>
            {alerts.map((alert, index) => renderAlertCard(alert, index))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  descriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  descriptionText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 12,
    lineHeight: 20,
  },
  sosContainer: {
    marginBottom: 16,
  },
  sosCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sosInstruction: {
    marginTop: 16,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeAlertWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  warningSubtitle: {
    fontSize: 14,
    color: '#B91C1C',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertIcon: {
    marginRight: 8,
  },
  alertId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  escalationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  escalationText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    marginLeft: 4,
  },
  alertInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  alertFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginRight: 4,
  },
});

export default MySOSAlertsScreen;

