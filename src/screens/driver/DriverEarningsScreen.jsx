import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import mockData from '../../data/mockData.json';

const DriverEarningsScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [showWithdrawal, setShowWithdrawal] = useState(false);

  const driver = mockData.users[1];
  const earnings = driver.earnings;

  const periods = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'year', label: 'Năm này' }
  ];

  const earningsData = {
    today: { gross: 125000, commission: 18750, net: 106250, rides: 8 },
    week: { gross: 850000, commission: 127500, net: 722500, rides: 45 },
    month: { gross: 3200000, commission: 480000, net: 2720000, rides: 180 },
    year: { gross: 28500000, commission: 4275000, net: 24225000, rides: 1520 }
  };

  const currentData = earningsData[selectedPeriod];
  const commissionRate = earnings.commission;

  const recentEarnings = [
    {
      id: 1,
      date: '2024-01-16T14:30:00Z',
      riderName: 'Nguyen Van A',
      route: 'Ký túc xá A → Trường FPT',
      fare: 15000,
      commission: 2250,
      net: 12750,
      status: 'completed'
    },
    {
      id: 2,
      date: '2024-01-16T12:15:00Z',
      riderName: 'Le Thi B',
      route: 'Nhà văn hóa → Chợ Bến Thành',
      fare: 25000,
      commission: 3750,
      net: 21250,
      status: 'completed'
    },
    {
      id: 3,
      date: '2024-01-16T10:45:00Z',
      riderName: 'Pham Van C',
      route: 'Trọ sinh viên → Trường FPT',
      fare: 18000,
      commission: 2700,
      net: 15300,
      status: 'completed'
    }
  ];

  const handleWithdrawal = () => {
    Alert.alert(
      'Yêu cầu rút tiền',
      `Số dư khả dụng: ${earnings.thisMonth.toLocaleString()} VNĐ\nPhí xử lý: 5,000 VNĐ`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Tiếp tục', onPress: () => setShowWithdrawal(true) }
      ]
    );
  };

  const confirmWithdrawal = (amount) => {
    Alert.alert(
      'Xác nhận rút tiền',
      `Rút ${amount.toLocaleString()} VNĐ về tài khoản ngân hàng?\nYêu cầu sẽ được xử lý trong 1-2 ngày làm việc.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', onPress: () => {
          setShowWithdrawal(false);
          Alert.alert('Thành công', 'Yêu cầu rút tiền đã được gửi đi. Chúng tôi sẽ xử lý trong 1-2 ngày làm việc.');
        }}
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#10412F', '#000000']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Thu nhập của tôi</Text>
            <Text style={styles.headerSubtitle}>Theo dõi thu nhập và rút tiền</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Period Selector */}
          <View style={styles.periodSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period.key}
                  style={[
                    styles.periodTab,
                    selectedPeriod === period.key && styles.periodTabActive
                  ]}
                  onPress={() => setSelectedPeriod(period.key)}
                >
                  <Text style={[
                    styles.periodTabText,
                    selectedPeriod === period.key && styles.periodTabTextActive
                  ]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Earnings Summary */}
          <Animatable.View animation="fadeInUp" style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Tổng quan thu nhập</Text>
            
            <View style={styles.summaryStats}>
              <View style={styles.summaryItem}>
                <LinearGradient
                  colors={['#2196F3', '#1976D2']}
                  style={styles.summaryIcon}
                >
                  <Icon name="trending-up" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.summaryValue}>
                  {currentData.gross.toLocaleString()}đ
                </Text>
                <Text style={styles.summaryLabel}>Tổng doanh thu</Text>
              </View>

              <View style={styles.summaryItem}>
                <LinearGradient
                  colors={['#FF9800', '#F57C00']}
                  style={styles.summaryIcon}
                >
                  <Icon name="remove" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.summaryValue}>
                  {currentData.commission.toLocaleString()}đ
                </Text>
                <Text style={styles.summaryLabel}>Hoa hồng ({(commissionRate * 100)}%)</Text>
              </View>

              <View style={styles.summaryItem}>
                <LinearGradient
                  colors={['#10412F', '#000000']}
                  style={styles.summaryIcon}
                >
                  <Icon name="attach-money" size={24} color="#fff" />
                </LinearGradient>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {currentData.net.toLocaleString()}đ
                </Text>
                <Text style={styles.summaryLabel}>Thu nhập ròng</Text>
              </View>
            </View>

            <View style={styles.ridesInfo}>
              <Icon name="directions-car" size={20} color="#666" />
              <Text style={styles.ridesText}>
                {currentData.rides} chuyến đi • Trung bình {Math.round(currentData.net / currentData.rides).toLocaleString()}đ/chuyến
              </Text>
            </View>
          </Animatable.View>

          {/* Available Balance */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceTitle}>Số dư khả dụng</Text>
              <TouchableOpacity onPress={() => Alert.alert('Thông tin', 'Số tiền bạn có thể rút về tài khoản ngân hàng')}>
                <Icon name="info" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>
              {earnings.thisMonth.toLocaleString()} VNĐ
            </Text>
            <ModernButton
              title="Rút tiền"
              icon="account-balance"
              onPress={handleWithdrawal}
              style={styles.withdrawButton}
            />
          </View>

          {/* Recent Earnings */}
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Thu nhập gần đây</Text>
            {recentEarnings.map((earning) => (
              <View key={earning.id} style={styles.earningItem}>
                <View style={styles.earningHeader}>
                  <Text style={styles.earningTime}>{formatDate(earning.date)}</Text>
                  <Text style={styles.earningAmount}>+{earning.net.toLocaleString()}đ</Text>
                </View>
                <Text style={styles.earningRider}>{earning.riderName}</Text>
                <Text style={styles.earningRoute}>{earning.route}</Text>
                <View style={styles.earningBreakdown}>
                  <Text style={styles.breakdownText}>
                    Cước phí: {earning.fare.toLocaleString()}đ
                  </Text>
                  <Text style={styles.breakdownText}>
                    Hoa hồng: -{earning.commission.toLocaleString()}đ
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Statistics */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Thống kê chi tiết</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#9C27B0', '#7B1FA2']}
                  style={styles.statIcon}
                >
                  <Icon name="schedule" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>6.5h</Text>
                <Text style={styles.statLabel}>Thời gian online</Text>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#FF5722', '#D84315']}
                  style={styles.statIcon}
                >
                  <Icon name="speed" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>12.5</Text>
                <Text style={styles.statLabel}>Km trung bình</Text>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#607D8B', '#455A64']}
                  style={styles.statIcon}
                >
                  <Icon name="local-gas-station" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>25k</Text>
                <Text style={styles.statLabel}>Chi phí xăng</Text>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#795548', '#5D4037']}
                  style={styles.statIcon}
                >
                  <Icon name="star" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>4.8</Text>
                <Text style={styles.statLabel}>Đánh giá TB</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Withdrawal Modal */}
      {showWithdrawal && (
        <View style={styles.modalOverlay}>
          <Animatable.View animation="slideInUp" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rút tiền</Text>
              <TouchableOpacity onPress={() => setShowWithdrawal(false)}>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.availableBalance}>
                Số dư khả dụng: {earnings.thisMonth.toLocaleString()} VNĐ
              </Text>
              
              <View style={styles.withdrawalOptions}>
                <TouchableOpacity 
                  style={styles.withdrawalOption}
                  onPress={() => confirmWithdrawal(100000)}
                >
                  <Text style={styles.withdrawalAmount}>100,000đ</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.withdrawalOption}
                  onPress={() => confirmWithdrawal(200000)}
                >
                  <Text style={styles.withdrawalAmount}>200,000đ</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.withdrawalOption}
                  onPress={() => confirmWithdrawal(earnings.thisMonth)}
                >
                  <Text style={styles.withdrawalAmount}>Tất cả</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.withdrawalNote}>
                • Phí xử lý: 5,000 VNĐ{'\n'}
                • Thời gian xử lý: 1-2 ngày làm việc{'\n'}
                • Tiền sẽ được chuyển vào tài khoản đã đăng ký
              </Text>
            </View>
          </Animatable.View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  periodSelector: {
    marginBottom: 20,
  },
  periodTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodTabActive: {
    backgroundColor: '#4CAF50',
  },
  periodTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodTabTextActive: {
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  ridesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  ridesText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 16,
  },
  withdrawButton: {
    marginTop: 8,
  },
  recentSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  earningItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  earningTime: {
    fontSize: 12,
    color: '#666',
  },
  earningAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  earningRider: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  earningRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  earningBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownText: {
    fontSize: 12,
    color: '#999',
  },
  statsSection: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalBody: {
    padding: 20,
  },
  availableBalance: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  withdrawalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  withdrawalOption: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingVertical: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  withdrawalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  withdrawalNote: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});

export default DriverEarningsScreen;