import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import AppBackground from '../../components/layout/AppBackground.jsx';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import ModernButton from '../../components/ModernButton.jsx';
import reportService from '../../services/reportService';
import { colors } from '../../theme/designTokens';

const ReportManagementScreen = ({ navigation }) => {
  // State management
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [updateData, setUpdateData] = useState({
    status: '',
    adminNotes: '',
  });

  // Filter options
  const statusFilters = [
    { key: 'all', label: 'Tất cả' },
    ...reportService.getReportStatuses(),
  ];

  const typeFilters = [
    { key: 'all', label: 'Tất cả loại' },
    ...reportService.getReportTypes(),
  ];

  // Load reports on mount and when filters change
  useEffect(() => {
    loadReports();
  }, [currentPage, selectedStatus, selectedType]);

  // Filter reports by search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredReports(reports);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = reports.filter(
        (report) =>
          report.description?.toLowerCase().includes(query) ||
          report.reportType?.toLowerCase().includes(query) ||
          report.reportId?.toString().includes(query)
      );
      setFilteredReports(filtered);
    }
  }, [searchQuery, reports]);

  const loadReports = async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const params = {
        page: currentPage,
        size: 20,
      };

      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedType !== 'all') params.reportType = selectedType;

      const response = await reportService.getAllReports(params);

      // Handle both PageResponse and direct array
      if (response.data) {
        setReports(response.data);
        setFilteredReports(response.data);
        setTotalPages(response.totalPages || 1);
        setTotalElements(response.totalElements || response.data.length);
      } else if (Array.isArray(response)) {
        setReports(response);
        setFilteredReports(response);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách báo cáo');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(0);
    await loadReports(false);
    setRefreshing(false);
  };

  const handleReportPress = (report) => {
    setSelectedReport(report);
    setShowDetailsModal(true);
  };

  const handleUpdateStatus = (report) => {
    setSelectedReport(report);
    setUpdateData({
      status: report.status,
      adminNotes: report.adminNotes || '',
    });
    setShowDetailsModal(false);
    setShowUpdateModal(true);
  };

  const submitStatusUpdate = async () => {
    if (!updateData.status) {
      Alert.alert('Lỗi', 'Vui lòng chọn trạng thái');
      return;
    }

    try {
      setLoading(true);
      await reportService.updateReportStatus(selectedReport.reportId, updateData);
      Alert.alert('Thành công', 'Đã cập nhật trạng thái báo cáo', [
        {
          text: 'OK',
          onPress: () => {
            setShowUpdateModal(false);
            setSelectedReport(null);
            setUpdateData({ status: '', adminNotes: '' });
            loadReports();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating report:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const renderReportCard = (report) => {
    const statusColor = reportService.getReportStatusColor(report.status);
    const typeIcon = reportService.getReportTypeIcon(report.reportType);

    return (
      <TouchableOpacity
        key={report.reportId}
        onPress={() => handleReportPress(report)}
        activeOpacity={0.7}
      >
        <CleanCard style={styles.cardSpacing} contentStyle={styles.reportCard}>
          {/* Header */}
          <View style={styles.reportHeader}>
            <View style={styles.reportHeaderLeft}>
              <View style={[styles.typeIcon, { backgroundColor: statusColor + '20' }]}>
                <Icon name={typeIcon} size={20} color={statusColor} />
              </View>
              <View style={styles.reportHeaderInfo}>
                <Text style={styles.reportId}>#{report.reportId}</Text>
                <Text style={styles.reportType}>
                  {reportService.getReportTypeText(report.reportType)}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {reportService.getReportStatusText(report.status)}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.reportDescription} numberOfLines={2}>
            {report.description}
          </Text>

          {/* Meta info */}
          <View style={styles.reportMeta}>
            <View style={styles.metaItem}>
              <Icon name="person" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>
                Người báo cáo: {report.reporterName || `ID ${report.reporterId}`}
              </Text>
            </View>
            {report.sharedRideId && (
              <View style={styles.metaItem}>
                <Icon name="directions-car" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>Chuyến đi: #{report.sharedRideId}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.reportFooter}>
            <Text style={styles.reportDate}>
              {reportService.formatDate(report.createdAt)}
            </Text>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={() => handleUpdateStatus(report)}
            >
              <Icon name="edit" size={16} color={colors.accent} />
              <Text style={styles.updateButtonText}>Cập nhật</Text>
            </TouchableOpacity>
          </View>
        </CleanCard>
      </TouchableOpacity>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedReport) return null;

    const statusColor = reportService.getReportStatusColor(selectedReport.status);
    const typeIcon = reportService.getReportTypeIcon(selectedReport.reportType);

    return (
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View animation="fadeInUp" duration={300} style={styles.detailsModal}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết báo cáo</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalContent}>
              {/* Status & Type */}
              <View style={styles.detailRow}>
                <View style={[styles.typeIcon, { backgroundColor: statusColor + '20' }]}>
                  <Icon name={typeIcon} size={24} color={statusColor} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Trạng thái</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {reportService.getReportStatusText(selectedReport.status)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Report ID */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Mã báo cáo</Text>
                <Text style={styles.detailValue}>#{selectedReport.reportId}</Text>
              </View>

              {/* Report Type */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Loại báo cáo</Text>
                <Text style={styles.detailValue}>
                  {reportService.getReportTypeText(selectedReport.reportType)}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Mô tả</Text>
                <Text style={styles.detailValue}>{selectedReport.description}</Text>
              </View>

              {/* Reporter Info */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Người báo cáo</Text>
                <Text style={styles.detailValue}>
                  {selectedReport.reporterName || `User ID: ${selectedReport.reporterId}`}
                </Text>
              </View>

              {/* Ride Info */}
              {selectedReport.sharedRideId && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Chuyến đi</Text>
                  <Text style={styles.detailValue}>#{selectedReport.sharedRideId}</Text>
                </View>
              )}

              {/* Driver Info */}
              {selectedReport.driverId && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Tài xế</Text>
                  <Text style={styles.detailValue}>
                    {selectedReport.driverName || `Driver ID: ${selectedReport.driverId}`}
                  </Text>
                </View>
              )}

              {/* Admin Notes */}
              {selectedReport.adminNotes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Ghi chú admin</Text>
                  <Text style={styles.detailValue}>{selectedReport.adminNotes}</Text>
                </View>
              )}

              {/* Resolution Message */}
              {selectedReport.resolutionMessage && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Thông báo giải quyết</Text>
                  <Text style={styles.detailValue}>{selectedReport.resolutionMessage}</Text>
                </View>
              )}

              {/* Timestamps */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Thời gian tạo</Text>
                <Text style={styles.detailValue}>
                  {reportService.formatDate(selectedReport.createdAt)}
                </Text>
              </View>

              {selectedReport.resolvedAt && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Thời gian giải quyết</Text>
                  <Text style={styles.detailValue}>
                    {reportService.formatDate(selectedReport.resolvedAt)}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleUpdateStatus(selectedReport)}
              >
                <Icon name="edit" size={20} color={colors.accent} />
                <Text style={styles.modalButtonText}>Cập nhật trạng thái</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    );
  };

  const renderUpdateModal = () => {
    return (
      <Modal
        visible={showUpdateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View animation="fadeInUp" duration={300} style={styles.updateModal}>
            <Text style={styles.modalTitle}>Cập nhật trạng thái</Text>
            <Text style={styles.modalSubtitle}>
              Báo cáo #{selectedReport?.reportId}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Status Selection */}
              <Text style={styles.inputLabel}>Trạng thái</Text>
              <View style={styles.statusSelection}>
                {reportService.getReportStatuses().map((status) => {
                  const isSelected = updateData.status === status.key;
                  const statusColor = reportService.getReportStatusColor(status.key);

                  return (
                    <TouchableOpacity
                      key={status.key}
                      style={[
                        styles.statusOption,
                        isSelected && {
                          backgroundColor: statusColor + '20',
                          borderColor: statusColor,
                        },
                      ]}
                      onPress={() => setUpdateData({ ...updateData, status: status.key })}
                    >
                      <View
                        style={[
                          styles.statusOptionDot,
                          { backgroundColor: statusColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusOptionText,
                          isSelected && { color: statusColor, fontWeight: '600' },
                        ]}
                      >
                        {status.label}
                      </Text>
                      {isSelected && <Icon name="check" size={18} color={statusColor} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Admin Notes */}
              <Text style={styles.inputLabel}>Ghi chú (tùy chọn)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Nhập ghi chú về báo cáo..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={updateData.adminNotes}
                onChangeText={(text) =>
                  setUpdateData({ ...updateData, adminNotes: text })
                }
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowUpdateModal(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <ModernButton
                title="Cập nhật"
                size="small"
                onPress={submitStatusUpdate}
                disabled={loading}
              />
            </View>
          </Animatable.View>
        </View>
      </Modal>
    );
  };

  if (loading && reports.length === 0) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Đang tải báo cáo...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Header */}
          <View style={styles.headerSpacing}>
            <GlassHeader title="Quản lý báo cáo" subtitle="Xử lý báo cáo từ người dùng" />
          </View>

          {/* Search & Filters */}
          <Animatable.View animation="fadeInUp" duration={480} delay={40}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.searchSection}>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Icon name="search" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm báo cáo..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="clear" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Filter */}
              <Text style={styles.filterLabel}>Trạng thái</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {statusFilters.map((option) => {
                  const active = selectedStatus === option.key;
                  const statusColor =
                    option.key !== 'all'
                      ? reportService.getReportStatusColor(option.key)
                      : colors.accent;

                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => {
                        setSelectedStatus(option.key);
                        setCurrentPage(0);
                      }}
                      style={[
                        styles.filterChip,
                        active && {
                          backgroundColor: statusColor + '20',
                          borderColor: statusColor + '50',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          active && { color: statusColor, fontWeight: '600' },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Type Filter */}
              <Text style={styles.filterLabel}>Loại báo cáo</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {typeFilters.map((option) => {
                  const active = selectedType === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => {
                        setSelectedType(option.key);
                        setCurrentPage(0);
                      }}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                    >
                      <Text
                        style={[styles.filterText, active && styles.filterTextActive]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </CleanCard>
          </Animatable.View>

          {/* Stats Summary */}
          <Animatable.View animation="fadeInUp" duration={500} delay={80}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.statsCard}>
              <View style={styles.statItem}>
                <Icon name="list" size={24} color={colors.accent} />
                <Text style={styles.statValue}>{totalElements}</Text>
                <Text style={styles.statLabel}>Tổng báo cáo</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="pending" size={24} color="#F59E0B" />
                <Text style={styles.statValue}>
                  {
                    reports.filter(
                      (r) => r.status === 'PENDING' || r.status === 'OPEN'
                    ).length
                  }
                </Text>
                <Text style={styles.statLabel}>Chờ xử lý</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="check-circle" size={24} color="#22C55E" />
                <Text style={styles.statValue}>
                  {reports.filter((r) => r.status === 'RESOLVED').length}
                </Text>
                <Text style={styles.statLabel}>Đã giải quyết</Text>
              </View>
            </CleanCard>
          </Animatable.View>

          {/* Reports List */}
          <Animatable.View animation="fadeInUp" duration={520} delay={120}>
            {filteredReports.length === 0 ? (
              <CleanCard style={styles.cardSpacing} contentStyle={styles.emptyState}>
                <Icon name="inbox" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>Không có báo cáo nào</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? 'Không tìm thấy kết quả phù hợp'
                    : 'Chưa có báo cáo từ người dùng'}
                </Text>
              </CleanCard>
            ) : (
              filteredReports.map((report) => renderReportCard(report))
            )}
          </Animatable.View>

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageButton, currentPage === 0 && styles.pageButtonDisabled]}
                onPress={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                <Icon
                  name="chevron-left"
                  size={20}
                  color={currentPage === 0 ? colors.textMuted : colors.accent}
                />
              </TouchableOpacity>

              <Text style={styles.pageText}>
                Trang {currentPage + 1} / {totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageButton,
                  currentPage >= totalPages - 1 && styles.pageButtonDisabled,
                ]}
                onPress={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                <Icon
                  name="chevron-right"
                  size={20}
                  color={
                    currentPage >= totalPages - 1 ? colors.textMuted : colors.accent
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {renderDetailsModal()}
        {renderUpdateModal()}
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: 140,
    paddingTop: 24,
  },
  headerSpacing: {
    marginBottom: 24,
  },
  cardSpacing: {
    marginHorizontal: 20,
    marginBottom: 18,
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

  // Search & Filter Styles
  searchSection: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassLight,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
  },
  filterRow: {
    gap: 10,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.accent,
  },

  // Stats Card Styles
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },

  // Report Card Styles
  reportCard: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportHeaderInfo: {
    flex: 1,
  },
  reportId: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
  },
  reportType: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  reportDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reportMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  reportDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.accent + '15',
  },
  updateButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accent,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  detailsModal: {
    backgroundColor: '#F7F8FC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
    shadowColor: 'rgba(15,23,42,0.2)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  updateModal: {
    backgroundColor: '#F7F8FC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '75%',
    shadowColor: 'rgba(15,23,42,0.2)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 18,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    padding: 12,
    backgroundColor: colors.glassLight,
    borderRadius: 16,
  },
  detailInfo: {
    flex: 1,
    gap: 6,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  modalActions: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.accent + '15',
  },
  modalButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accent,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 12,
  },
  statusSelection: {
    gap: 10,
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  statusOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
});

export default ReportManagementScreen;

