import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
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
import reportService from '../../services/reportService';
import { colors } from '../../theme/designTokens';

/**
 * Screen for users to view their own submitted reports
 */
const MyReportsScreen = ({ navigation }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await reportService.getMyReports({ page: 0, size: 50 });
      
      // Handle both PageResponse and direct array
      if (response.data) {
        setReports(response.data);
      } else if (Array.isArray(response)) {
        setReports(response);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  }, []);

  const handleReportPress = (report) => {
    setSelectedReport(report);
    setShowDetailsModal(true);
  };

  const renderReportCard = (report) => {
    const statusColor = reportService.getReportStatusColor(report.status);
    const priorityColor = reportService.getPriorityColor(report.priority || 'MEDIUM');
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

            <View style={styles.badges}>
              {/* Priority Badge */}
              <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
                <Icon
                  name={reportService.getPriorityIcon(report.priority || 'MEDIUM')}
                  size={12}
                  color={priorityColor}
                />
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {reportService.getPriorityText(report.priority || 'MEDIUM')}
                </Text>
              </View>

              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {reportService.getReportStatusText(report.status)}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.reportDescription} numberOfLines={2}>
            {report.description}
          </Text>

          {/* Meta info */}
          <View style={styles.reportMeta}>
            {report.sharedRideId && (
              <View style={styles.metaItem}>
                <Icon name="directions-car" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>Chuyến đi: #{report.sharedRideId}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Icon name="schedule" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>
                {reportService.formatDate(report.createdAt)}
              </Text>
            </View>
          </View>

          {/* Footer with action */}
          <View style={styles.reportFooter}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleReportPress(report)}
            >
              <Text style={styles.viewButtonText}>Xem chi tiết</Text>
              <Icon name="chevron-right" size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </CleanCard>
      </TouchableOpacity>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedReport) return null;

    const statusColor = reportService.getReportStatusColor(selectedReport.status);
    const priorityColor = reportService.getPriorityColor(selectedReport.priority || 'MEDIUM');
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
                  <Text style={styles.detailLabel}>Trạng thái & Mức độ</Text>
                  <View style={styles.badgesRow}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {reportService.getReportStatusText(selectedReport.status)}
                      </Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
                      <Icon
                        name={reportService.getPriorityIcon(selectedReport.priority || 'MEDIUM')}
                        size={12}
                        color={priorityColor}
                      />
                      <Text style={[styles.priorityText, { color: priorityColor }]}>
                        {reportService.getPriorityText(selectedReport.priority || 'MEDIUM')}
                      </Text>
                    </View>
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

              {/* Ride Info */}
              {selectedReport.sharedRideId && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Chuyến đi</Text>
                  <Text style={styles.detailValue}>#{selectedReport.sharedRideId}</Text>
                </View>
              )}

              {/* Admin Notes (if resolved/dismissed) */}
              {selectedReport.resolutionMessage && (
                <View style={[styles.detailSection, styles.highlightSection]}>
                  <Icon name="info" size={20} color={colors.accent} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.detailLabel}>Thông báo từ quản trị viên</Text>
                    <Text style={styles.detailValue}>{selectedReport.resolutionMessage}</Text>
                  </View>
                </View>
              )}

              {/* Driver Response (if any) */}
              {selectedReport.driverResponse && (
                <View style={[styles.detailSection, styles.highlightSection]}>
                  <Icon name="person" size={20} color={colors.accent} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.detailLabel}>Phản hồi từ tài xế</Text>
                    <Text style={styles.detailValue}>{selectedReport.driverResponse}</Text>
                    <Text style={styles.metaText}>
                      {reportService.formatDate(selectedReport.driverRespondedAt)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Escalation info (if escalated) */}
              {selectedReport.escalatedAt && (
                <View style={[styles.detailSection, styles.warningSection]}>
                  <Icon name="priority-high" size={20} color="#F59E0B" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.detailLabel, { color: '#F59E0B' }]}>
                      Báo cáo đã được ưu tiên
                    </Text>
                    <Text style={styles.detailValue}>{selectedReport.escalationReason}</Text>
                  </View>
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

            {/* Close Button */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDetailsModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>
    );
  };

  if (loading) {
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            
            <GlassHeader
              title="Báo cáo của tôi"
              subtitle="Theo dõi trạng thái báo cáo đã gửi"
            />
          </View>

          {/* Summary */}
          <Animatable.View animation="fadeInUp" duration={480} delay={40}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Icon name="list" size={24} color={colors.accent} />
                <Text style={styles.summaryValue}>{reports.length}</Text>
                <Text style={styles.summaryLabel}>Tổng báo cáo</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Icon name="pending" size={24} color="#F59E0B" />
                <Text style={styles.summaryValue}>
                  {reports.filter((r) => r.status === 'PENDING' || r.status === 'OPEN' || r.status === 'IN_PROGRESS').length}
                </Text>
                <Text style={styles.summaryLabel}>Đang xử lý</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Icon name="check-circle" size={24} color="#22C55E" />
                <Text style={styles.summaryValue}>
                  {reports.filter((r) => r.status === 'RESOLVED').length}
                </Text>
                <Text style={styles.summaryLabel}>Đã giải quyết</Text>
              </View>
            </CleanCard>
          </Animatable.View>

          {/* Reports List */}
          <Animatable.View animation="fadeInUp" duration={500} delay={80}>
            {reports.length === 0 ? (
              <CleanCard style={styles.cardSpacing} contentStyle={styles.emptyState}>
                <Icon name="inbox" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>Chưa có báo cáo</Text>
                <Text style={styles.emptySubtext}>
                  Báo cáo bạn gửi sẽ hiển thị ở đây
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => navigation.navigate('ReportSubmit')}
                >
                  <Icon name="add" size={20} color={colors.accent} />
                  <Text style={styles.createButtonText}>Tạo báo cáo mới</Text>
                </TouchableOpacity>
              </CleanCard>
            ) : (
              reports.map((report) => renderReportCard(report))
            )}
          </Animatable.View>
        </ScrollView>

        {renderDetailsModal()}
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
  headerSpacing: {
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 8,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
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

  // Summary Card
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },

  // Report Card
  reportCard: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
  badges: {
    gap: 6,
    alignItems: 'flex-end',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.accent + '15',
    marginTop: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accent,
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
    maxHeight: '85%',
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
    gap: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailSection: {
    marginBottom: 16,
  },
  highlightSection: {
    flexDirection: 'row',
    backgroundColor: colors.accent + '10',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  warningSection: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
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
  modalCloseButton: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});

export default MyReportsScreen;

