import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';
import { Dropdown } from 'react-native-element-dropdown';
import sosService from '../../services/sosService';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';
import { StatusBar } from 'react-native';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const SOSHistoryScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [alertDetail, setAlertDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterFocus, setIsFilterFocus] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'Tất cả' },
    { value: 'ACTIVE', label: 'Đang hoạt động' },
    { value: 'ESCALATED', label: 'Đã báo cáo' },
    { value: 'ACKNOWLEDGED', label: 'Đã xác nhận' },
    { value: 'RESOLVED', label: 'Đã giải quyết' },
    { value: 'FALSE_ALARM', label: 'Báo động giả' },
  ];

  useEffect(() => {
    loadSOSHistory();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadSOSHistory();
    }, [])
  );

  const loadSOSHistory = async () => {
    try {
      setLoading(true);
      const response = await sosService.getMyAlerts();
      
      // Handle different response formats
      let alertsList = [];
      if (Array.isArray(response)) {
        alertsList = response;
      } else if (response?.content && Array.isArray(response.content)) {
        alertsList = response.content;
      } else if (response?.data && Array.isArray(response.data)) {
        alertsList = response.data;
      } else if (response?.alerts && Array.isArray(response.alerts)) {
        alertsList = response.alerts;
      }

      // Sort by created_at descending (newest first)
      alertsList.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || a.timestamp);
        const dateB = new Date(b.created_at || b.createdAt || b.timestamp);
        return dateB - dateA;
      });

      setAlerts(alertsList);
      applyFilter(alertsList, statusFilter);
    } catch (error) {
      console.error('Error loading SOS history:', error);
      setAlerts([]);
      setFilteredAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (alertsList, filter) => {
    if (filter === 'all') {
      setFilteredAlerts(alertsList);
    } else {
      const filtered = alertsList.filter(alert => {
        const alertStatus = alert.status || alert.status;
        return alertStatus === filter || alertStatus?.toUpperCase() === filter;
      });
      setFilteredAlerts(filtered);
    }
  };

  const handleFilterChange = (item) => {
    setStatusFilter(item.value);
    applyFilter(alerts, item.value);
    setIsFilterFocus(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSOSHistory();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Không xác định';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;

      // Format full date
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return 'Không xác định';
    }
  };

  const parseRideSnapshot = (snapshotString) => {
    if (!snapshotString) return null;
    
    try {
      if (typeof snapshotString === 'string') {
        return JSON.parse(snapshotString);
      }
      return snapshotString;
    } catch (error) {
      console.error('Error parsing ride snapshot:', error);
      return null;
    }
  };

  const handleViewDetails = async (alert) => {
    setSelectedAlert(alert);
    setDetailModalVisible(true);
    setDetailLoading(true);
    setAlertDetail(null);

    try {
      const alertId = alert.sosId || alert.id || alert.sos_alert_id;
      if (alertId) {
        const detail = await sosService.getAlertDetail(alertId);
        setAlertDetail(detail);
      } else {
        // Fallback: use alert data directly
        setAlertDetail(alert);
      }
    } catch (error) {
      console.error('Error loading alert detail:', error);
      // Fallback: use alert data directly
      setAlertDetail(alert);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatFullDate = (dateString) => {
    if (!dateString) return 'Không xác định';
    
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return 'Không xác định';
    }
  };

  const getStatusLabel = (status) => {
    if (!status) return 'Đang xử lý';
    const statusUpper = status.toUpperCase();
    switch (statusUpper) {
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
        return 'Đang xử lý';
    }
  };


  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" />
          <SoftBackHeader
            floating
            topOffset={headerOffset}
            title="Lịch sử SOS"
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Đang tải lịch sử SOS...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title="Lịch sử SOS"
          onBackPress={() => navigation.goBack()}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Filter Section */}
          <View style={styles.filterContainer}>
            <Dropdown
              style={[styles.dropdown, isFilterFocus && { borderColor: colors.primary }]}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              inputSearchStyle={styles.dropdownInputSearch}
              iconStyle={styles.dropdownIcon}
              data={statusOptions}
              search={false}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Lọc theo trạng thái"
              value={statusFilter}
              onFocus={() => setIsFilterFocus(true)}
              onBlur={() => setIsFilterFocus(false)}
              onChange={handleFilterChange}
              renderLeftIcon={() => (
                <Icon
                  style={styles.dropdownLeftIcon}
                  name="filter-list"
                  size={20}
                  color={isFilterFocus ? colors.primary : colors.textSecondary}
                />
              )}
            />
          </View>

          {filteredAlerts.length === 0 ? (
            <Animatable.View animation="fadeInUp" duration={480}>
              <CleanCard style={styles.cardSpacing} contentStyle={styles.emptyCardContent}>
                <View style={styles.emptyIconContainer}>
                  <Icon name="emergency" size={64} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Chưa có lịch sử SOS</Text>
                <Text style={styles.emptyText}>
                  Bạn chưa có lần nào kích hoạt SOS. Lịch sử sẽ hiển thị tại đây khi bạn sử dụng tính năng SOS.
                </Text>
              </CleanCard>
            </Animatable.View>
          ) : (
            <>
              {filteredAlerts.map((alert, index) => {
                const rideSnapshot = parseRideSnapshot(alert.ride_snapshot || alert.rideSnapshot);
                const alertDate = alert.created_at || alert.createdAt || alert.timestamp;
                
                return (
                  <Animatable.View
                    key={alert.sosId || alert.id || alert.sos_alert_id || index}
                    animation="fadeInUp"
                    duration={480}
                    delay={index * 50}
                  >
                    <CleanCard style={styles.cardSpacing} contentStyle={styles.alertCardContent}>
                      <View style={styles.alertHeader}>
                        <View style={styles.alertIconContainer}>
                          <Icon name="emergency" size={22} color="#FFFFFF" />
                        </View>
                        <View style={styles.alertInfo}>
                          <Text style={styles.alertTime}>{formatDate(alertDate)}</Text>
                          {alert.description && (
                            <Text style={styles.alertDescription} numberOfLines={2}>
                              {alert.description}
                            </Text>
                          )}
                        </View>
                        {alert.status && (
                          <View
                            style={[
                              styles.statusBadge,
                              alert.status === 'RESOLVED' || alert.status === 'resolved' || alert.status === 'FALSE_ALARM' || alert.status === 'false_alarm'
                                ? styles.statusResolved
                                : alert.status === 'ESCALATED' || alert.status === 'escalated'
                                ? styles.statusEscalated
                                : alert.status === 'ACKNOWLEDGED' || alert.status === 'acknowledged'
                                ? styles.statusAcknowledged
                                : styles.statusActive,
                            ]}
                          >
                            <Text style={styles.statusText}>
                              {getStatusLabel(alert.status)}
                            </Text>
                          </View>
                        )}
                      </View>


                      {rideSnapshot && (
                        <>
                          {rideSnapshot.rideId && (
                            <View style={styles.detailRow}>
                              <Icon name="directions-car" size={18} color={colors.textSecondary} />
                              <Text style={styles.detailText}>
                                Chuyến #{rideSnapshot.rideId}
                              </Text>
                            </View>
                          )}
                          {rideSnapshot.status && (
                            <View style={styles.detailRow}>
                              <Icon name="info-outline" size={18} color={colors.textSecondary} />
                              <Text style={styles.detailText}>
                                Trạng thái: {rideSnapshot.status}
                              </Text>
                            </View>
                          )}
                        </>
                      )}

                      <TouchableOpacity
                        style={styles.viewDetailButton}
                        onPress={() => handleViewDetails(alert)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewDetailText}>Xem chi tiết</Text>
                        <Icon name="chevron-right" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </CleanCard>
                  </Animatable.View>
                );
              })}
              <View style={styles.footerContainer}>
                <Text style={styles.footerText}>
                  {statusFilter === 'all' 
                    ? `Tổng cộng: ${alerts.length} ${alerts.length === 1 ? 'lần' : 'lần'} kích hoạt SOS`
                    : `Hiển thị: ${filteredAlerts.length} / ${alerts.length} ${alerts.length === 1 ? 'lần' : 'lần'} kích hoạt SOS`}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết SOS</Text>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.modalLoadingText}>Đang tải chi tiết...</Text>
              </View>
            ) : alertDetail ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Basic Info */}
                <CleanCard style={styles.modalCard} contentStyle={styles.modalCardContent}>
                  <View style={styles.modalSectionHeader}>
                    <Icon name="info" size={20} color={colors.primary} />
                    <Text style={styles.modalSectionTitle}>Thông tin cơ bản</Text>
                  </View>
                  
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Mã SOS:</Text>
                    <Text style={styles.modalInfoValue}>
                      #{alertDetail.sosId || alertDetail.id || alertDetail.sos_alert_id || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Thời gian:</Text>
                    <Text style={styles.modalInfoValue}>
                      {formatFullDate(alertDetail.created_at || alertDetail.createdAt || alertDetail.timestamp)}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Trạng thái:</Text>
                    <View
                      style={[
                        styles.modalStatusBadge,
                        (() => {
                          const statusUpper = (alertDetail.status || '').toUpperCase();
                          if (statusUpper === 'RESOLVED' || statusUpper === 'FALSE_ALARM') {
                            return styles.statusResolved;
                          } else if (statusUpper === 'ESCALATED') {
                            return styles.statusEscalated;
                          } else if (statusUpper === 'ACKNOWLEDGED') {
                            return styles.statusAcknowledged;
                          }
                          return styles.statusActive;
                        })(),
                      ]}
                    >
                      <Text style={styles.modalStatusText}>
                        {getStatusLabel(alertDetail.status)}
                      </Text>
                    </View>
                  </View>
                  

                  {alertDetail.description && (
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Mô tả:</Text>
                      <Text style={[styles.modalInfoValue, styles.modalDescription]}>
                        {alertDetail.description}
                      </Text>
                    </View>
                  )}
                </CleanCard>


                {/* Ride Info */}
                {parseRideSnapshot(alertDetail.ride_snapshot || alertDetail.rideSnapshot) && (
                  <CleanCard style={styles.modalCard} contentStyle={styles.modalCardContent}>
                    <View style={styles.modalSectionHeader}>
                      <Icon name="directions-car" size={20} color={colors.primary} />
                      <Text style={styles.modalSectionTitle}>Thông tin chuyến đi</Text>
                    </View>
                    
                    {(() => {
                      const snapshot = parseRideSnapshot(alertDetail.ride_snapshot || alertDetail.rideSnapshot);
                      return (
                        <>
                          {snapshot.rideId && (
                            <View style={styles.modalInfoRow}>
                              <Text style={styles.modalInfoLabel}>Mã chuyến:</Text>
                              <Text style={styles.modalInfoValue}>#{snapshot.rideId}</Text>
                            </View>
                          )}
                          {snapshot.status && (
                            <View style={styles.modalInfoRow}>
                              <Text style={styles.modalInfoLabel}>Trạng thái chuyến:</Text>
                              <Text style={styles.modalInfoValue}>{snapshot.status}</Text>
                            </View>
                          )}
                          {snapshot.pickupLocation && (
                            <View style={styles.modalInfoRow}>
                              <Text style={styles.modalInfoLabel}>Điểm đón:</Text>
                              <Text style={styles.modalInfoValue}>{snapshot.pickupLocation}</Text>
                            </View>
                          )}
                          {snapshot.dropoffLocation && (
                            <View style={styles.modalInfoRow}>
                              <Text style={styles.modalInfoLabel}>Điểm đến:</Text>
                              <Text style={styles.modalInfoValue}>{snapshot.dropoffLocation}</Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </CleanCard>
                )}

                {/* Contact Info */}
                {(alertDetail.triggeredByPhone || alertDetail.riderPhone || alertDetail.driverPhone) && (
                  <CleanCard style={styles.modalCard} contentStyle={styles.modalCardContent}>
                    <View style={styles.modalSectionHeader}>
                      <Icon name="phone" size={20} color={colors.primary} />
                      <Text style={styles.modalSectionTitle}>Thông tin liên hệ</Text>
                    </View>
                    
                    {alertDetail.triggeredByPhone && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Người kích hoạt:</Text>
                        <Text style={styles.modalInfoValue}>{alertDetail.triggeredByPhone}</Text>
                      </View>
                    )}
                    {alertDetail.riderPhone && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>SĐT Rider:</Text>
                        <Text style={styles.modalInfoValue}>{alertDetail.riderPhone}</Text>
                      </View>
                    )}
                    {alertDetail.driverPhone && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>SĐT Driver:</Text>
                        <Text style={styles.modalInfoValue}>{alertDetail.driverPhone}</Text>
                      </View>
                    )}
                  </CleanCard>
                )}

                {/* Resolution Info */}
                {(alertDetail.resolvedAt || alertDetail.acknowledgedAt) && (
                  <CleanCard style={styles.modalCard} contentStyle={styles.modalCardContent}>
                    <View style={styles.modalSectionHeader}>
                      <Icon name="check-circle" size={20} color={colors.primary} />
                      <Text style={styles.modalSectionTitle}>Thông tin xử lý</Text>
                    </View>
                    
                    {alertDetail.acknowledgedAt && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Đã xác nhận lúc:</Text>
                        <Text style={styles.modalInfoValue}>
                          {formatFullDate(alertDetail.acknowledgedAt)}
                        </Text>
                      </View>
                    )}
                    {alertDetail.acknowledgedByName && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Người xác nhận:</Text>
                        <Text style={styles.modalInfoValue}>{alertDetail.acknowledgedByName}</Text>
                      </View>
                    )}
                    {alertDetail.resolvedAt && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Đã xử lý lúc:</Text>
                        <Text style={styles.modalInfoValue}>
                          {formatFullDate(alertDetail.resolvedAt)}
                        </Text>
                      </View>
                    )}
                    {alertDetail.resolvedByName && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Người xử lý:</Text>
                        <Text style={styles.modalInfoValue}>{alertDetail.resolvedByName}</Text>
                      </View>
                    )}
                    {alertDetail.resolutionNotes && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Ghi chú:</Text>
                        <Text style={[styles.modalInfoValue, styles.modalDescription]}>
                          {alertDetail.resolutionNotes}
                        </Text>
                      </View>
                    )}
                  </CleanCard>
                )}
              </ScrollView>
            ) : null}
          </View>
          </View>
        </Modal>

    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
    paddingHorizontal: 24,
    gap: 16,
  },
  cardSpacing: {
    marginBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  emptyCardContent: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  alertCardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  alertIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  alertInfo: {
    flex: 1,
    gap: 4,
  },
  alertTime: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  alertDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#FEE2E2',
  },
  statusResolved: {
    backgroundColor: '#D1FAE5',
  },
  statusEscalated: {
    backgroundColor: '#FEF3C7',
  },
  statusAcknowledged: {
    backgroundColor: '#DBEAFE',
  },
  // Filter Styles
  filterContainer: {
    marginBottom: 16,
  },
  dropdown: {
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  dropdownSelectedText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  dropdownInputSearch: {
    height: 40,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderRadius: 8,
  },
  dropdownIcon: {
    width: 20,
    height: 20,
  },
  dropdownLeftIcon: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1F2937',
    letterSpacing: 0.2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    flex: 1,
  },
  footerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  viewDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  viewDetailText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalLoadingContainer: {
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  modalScrollContent: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  modalCard: {
    marginBottom: 0,
  },
  modalCardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.1)',
  },
  modalInfoLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    minWidth: 120,
  },
  modalInfoValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
  },
  modalDescription: {
    lineHeight: 20,
  },
  modalStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  modalStatusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1F2937',
    letterSpacing: 0.2,
  },
});

export default SOSHistoryScreen;

