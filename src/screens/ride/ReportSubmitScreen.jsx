import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
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

/**
 * Screen for users to submit ride reports
 * Route params: { rideId: number } (optional - if provided, submit ride-specific report)
 */
const ReportSubmitScreen = ({ route, navigation }) => {
  const { rideId } = route?.params || {};

  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');

  // Report types for ride reports (restricted set)
  const rideReportTypes = [
    { key: 'SAFETY', label: 'An toàn', icon: 'security', description: 'Vấn đề về an toàn trong chuyến đi' },
    { key: 'BEHAVIOR', label: 'Hành vi', icon: 'person-outline', description: 'Hành vi không phù hợp của tài xế' },
    { key: 'PAYMENT', label: 'Thanh toán', icon: 'payment', description: 'Vấn đề về thanh toán' },
    { key: 'ROUTE', label: 'Tuyến đường', icon: 'route', description: 'Không đúng tuyến đường đã hẹn' },
    { key: 'OTHER', label: 'Khác', icon: 'more-horiz', description: 'Vấn đề khác' },
  ];

  // All report types for general reports
  const allReportTypes = reportService.getReportTypes();

  const reportTypes = rideId ? rideReportTypes : allReportTypes;

  const handleSubmit = async () => {
    // Validation
    if (!selectedType) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn loại báo cáo');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả chi tiết');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Mô tả quá ngắn', 'Vui lòng nhập mô tả ít nhất 10 ký tự');
      return;
    }

    if (description.trim().length > 2000) {
      Alert.alert('Mô tả quá dài', 'Mô tả không được vượt quá 2000 ký tự');
      return;
    }

    try {
      setLoading(true);

      const reportData = {
        reportType: selectedType,
        description: description.trim(),
        priority: selectedPriority,
      };

      let response;
      if (rideId) {
        // Submit ride-specific report
        response = await reportService.submitRideReport(rideId, reportData);
      } else {
        // Submit general user report
        response = await reportService.submitUserReport(reportData);
      }

      Alert.alert(
        'Thành công',
        'Báo cáo của bạn đã được gửi. Chúng tôi sẽ xem xét và phản hồi trong thời gian sớm nhất.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back or to home
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Submit report error:', error);
      let errorMessage = 'Không thể gửi báo cáo. Vui lòng thử lại sau.';

      if (error.message) {
        if (error.message.includes('completed')) {
          errorMessage = 'Chuyến đi phải hoàn thành trước khi gửi báo cáo';
        } else if (error.message.includes('window')) {
          errorMessage = 'Thời gian báo cáo đã hết hạn (7 ngày sau khi hoàn thành chuyến đi)';
        } else if (error.message.includes('already exists')) {
          errorMessage = 'Bạn đã gửi báo cáo cho chuyến đi này rồi';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderTypeCard = (type) => {
    const isSelected = selectedType === type.key;
    const statusColor = reportService.getReportStatusColor('PENDING');

    return (
      <TouchableOpacity
        key={type.key}
        onPress={() => setSelectedType(type.key)}
        activeOpacity={0.7}
      >
        <CleanCard
          style={styles.typeCard}
          contentStyle={[
            styles.typeCardContent,
            isSelected && {
              backgroundColor: statusColor + '15',
              borderColor: statusColor,
              borderWidth: 2,
            },
          ]}
        >
          <View style={styles.typeHeader}>
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: isSelected ? statusColor + '30' : colors.glassLight },
              ]}
            >
              <Icon
                name={type.icon || reportService.getReportTypeIcon(type.key)}
                size={24}
                color={isSelected ? statusColor : colors.textSecondary}
              />
            </View>
            <View style={styles.typeInfo}>
              <Text
                style={[
                  styles.typeLabel,
                  isSelected && { color: statusColor, fontWeight: '700' },
                ]}
              >
                {type.label}
              </Text>
              {type.description && (
                <Text style={styles.typeDescription}>{type.description}</Text>
              )}
            </View>
            {isSelected && (
              <Icon name="check-circle" size={24} color={statusColor} />
            )}
          </View>
        </CleanCard>
      </TouchableOpacity>
    );
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerSpacing}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Home');
                }
              }}
            >
              <Icon name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <GlassHeader
              title={rideId ? 'Báo cáo chuyến đi' : 'Gửi báo cáo'}
              subtitle={
                rideId
                  ? `Chuyến đi #${rideId}`
                  : 'Báo cáo vấn đề với quản trị viên'
              }
            />
          </View>

          {/* Instructions */}
          <Animatable.View animation="fadeInUp" duration={480} delay={40}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.instructionCard}>
              <View style={styles.instructionHeader}>
                <Icon name="info-outline" size={24} color={colors.accent} />
                <Text style={styles.instructionTitle}>Hướng dẫn</Text>
              </View>
              <Text style={styles.instructionText}>
                • Chọn loại báo cáo phù hợp với vấn đề của bạn{'\n'}
                • Mô tả chi tiết vấn đề (ít nhất 10 ký tự){'\n'}
                • Báo cáo sẽ được xem xét trong vòng 24-48 giờ{'\n'}
                {rideId && '• Chỉ có thể gửi báo cáo trong vòng 7 ngày sau chuyến đi'}
              </Text>
            </CleanCard>
          </Animatable.View>

          {/* Report Type Selection */}
          <Animatable.View animation="fadeInUp" duration={500} delay={80}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chọn loại báo cáo</Text>
              <Text style={styles.sectionSubtitle}>Chọn 1 trong các loại sau</Text>
            </View>

            <View style={styles.typesContainer}>
              {reportTypes.map((type) => renderTypeCard(type))}
            </View>
          </Animatable.View>

          {/* Priority Selection */}
          <Animatable.View animation="fadeInUp" duration={510} delay={100}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mức độ ưu tiên</Text>
              <Text style={styles.sectionSubtitle}>Chọn mức độ nghiêm trọng của vấn đề</Text>
            </View>

            <CleanCard style={styles.cardSpacing} contentStyle={styles.priorityCard}>
              <View style={styles.priorityOptions}>
                {reportService.getReportPriorities().map((priority) => {
                  const isSelected = selectedPriority === priority.key;
                  const priorityColor = reportService.getPriorityColor(priority.key);

                  return (
                    <TouchableOpacity
                      key={priority.key}
                      onPress={() => setSelectedPriority(priority.key)}
                      activeOpacity={0.7}
                      style={[
                        styles.priorityOption,
                        isSelected && {
                          backgroundColor: priorityColor + '15',
                          borderColor: priorityColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Icon
                        name={reportService.getPriorityIcon(priority.key)}
                        size={20}
                        color={isSelected ? priorityColor : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.priorityLabel,
                          isSelected && { color: priorityColor, fontWeight: '700' },
                        ]}
                      >
                        {priority.label}
                      </Text>
                      {isSelected && <Icon name="check-circle" size={18} color={priorityColor} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              <View style={styles.priorityHint}>
                <Icon name="info-outline" size={16} color={colors.textMuted} />
                <Text style={styles.priorityHintText}>
                  Mức độ cao hơn sẽ được ưu tiên xử lý nhanh hơn
                </Text>
              </View>
            </CleanCard>
          </Animatable.View>

          {/* Description Input */}
          <Animatable.View animation="fadeInUp" duration={520} delay={120}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.descriptionCard}>
              <View style={styles.descriptionHeader}>
                <Text style={styles.sectionTitle}>Mô tả chi tiết</Text>
                <Text style={styles.charCount}>
                  {description.length}/2000
                </Text>
              </View>
              <Text style={styles.descriptionHint}>
                Vui lòng mô tả chi tiết vấn đề bạn gặp phải. Thông tin càng cụ thể càng giúp chúng tôi xử lý nhanh hơn.
              </Text>

              <TextInput
                style={styles.textArea}
                placeholder="Nhập mô tả chi tiết về vấn đề..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={8}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
                maxLength={2000}
              />

              {/* Quick suggestions */}
              <Text style={styles.suggestionsLabel}>Gợi ý:</Text>
              <View style={styles.suggestions}>
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() =>
                    setDescription((prev) =>
                      prev ? `${prev}\n\nThời gian xảy ra: ` : 'Thời gian xảy ra: '
                    )
                  }
                >
                  <Icon name="schedule" size={14} color={colors.accent} />
                  <Text style={styles.suggestionText}>Thời gian</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() =>
                    setDescription((prev) =>
                      prev ? `${prev}\n\nĐịa điểm: ` : 'Địa điểm: '
                    )
                  }
                >
                  <Icon name="place" size={14} color={colors.accent} />
                  <Text style={styles.suggestionText}>Địa điểm</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() =>
                    setDescription((prev) =>
                      prev ? `${prev}\n\nNgười liên quan: ` : 'Người liên quan: '
                    )
                  }
                >
                  <Icon name="person" size={14} color={colors.accent} />
                  <Text style={styles.suggestionText}>Người liên quan</Text>
                </TouchableOpacity>
              </View>
            </CleanCard>
          </Animatable.View>

          {/* Submit Button */}
          <Animatable.View animation="fadeInUp" duration={540} delay={160} style={styles.submitContainer}>
            <ModernButton
              title={loading ? 'Đang gửi...' : 'Gửi báo cáo'}
              onPress={handleSubmit}
              disabled={loading || !selectedType || !description.trim()}
              style={styles.submitButton}
            />

            {loading && (
              <ActivityIndicator
                size="small"
                color={colors.accent}
                style={styles.loadingIndicator}
              />
            )}
          </Animatable.View>

          {/* Warning */}
          <Animatable.View animation="fadeIn" duration={600} delay={200}>
            <View style={styles.warningCard}>
              <Icon name="warning" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>
                Lưu ý: Vui lòng không gửi thông tin sai lệch. Mọi báo cáo sẽ được xem xét kỹ lưỡng.
              </Text>
            </View>
          </Animatable.View>
        </ScrollView>
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

  // Instruction Card
  instructionCard: {
    padding: 16,
    gap: 12,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instructionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Section Headers
  sectionHeader: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Type Cards
  typesContainer: {
    gap: 12,
  },
  typeCard: {
    marginHorizontal: 20,
    marginBottom: 0,
  },
  typeCardContent: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  typeDescription: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 2,
  },

  // Description Card
  descriptionCard: {
    padding: 16,
    gap: 12,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
  },
  descriptionHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  textArea: {
    backgroundColor: colors.glassLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 140,
    lineHeight: 20,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    marginTop: 4,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  suggestionText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.accent,
  },

  // Submit Button
  submitContainer: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  submitButton: {
    width: '100%',
  },
  loadingIndicator: {
    marginTop: 12,
  },

  // Warning
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#92400E',
    lineHeight: 18,
  },

  // Priority Selection
  priorityCard: {
    padding: 16,
    gap: 12,
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    minWidth: '47%',
  },
  priorityLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  priorityHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.15)',
  },
  priorityHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 16,
  },
});

export default ReportSubmitScreen;

