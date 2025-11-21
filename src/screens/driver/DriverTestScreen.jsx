import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

import websocketService from '../../services/websocketService';
import rideService from '../../services/rideService';
import FCMTestPanel from '../../components/FCMTestPanel';
import WebSocketTestPanel from '../../components/WebSocketTestPanel';

const DriverTestScreen = ({ navigation }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);

  const connectWebSocket = async () => {
    try {
      setConnectionStatus('connecting');
      
      await websocketService.connect();
      
      websocketService.subscribe('/user/queue/ride-offers', (message) => {
        console.log('Test: Received message:', message);
        setLastMessage(message);
        Alert.alert('Nhận được tin nhắn!', JSON.stringify(message, null, 2));
      });
      
      setConnectionStatus('connected');
      Alert.alert('Thành công', 'Đã kết nối WebSocket');
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('error');
      Alert.alert('Lỗi', 'Không thể kết nối WebSocket: ' + error.message);
    }
  };

  const disconnectWebSocket = () => {
    websocketService.disconnect();
    setConnectionStatus('disconnected');
    setLastMessage(null);
    Alert.alert('Thông báo', 'Đã ngắt kết nối WebSocket');
  };

  const testAcceptRide = async () => {
    if (!lastMessage || !lastMessage.requestId || !lastMessage.rideId) {
      Alert.alert('Lỗi', 'Không có ride offer để accept');
      return;
    }

    try {
      const response = await rideService.acceptRideRequest(
        lastMessage.requestId,
        lastMessage.rideId
      );
      
      Alert.alert('Thành công', 'Đã accept ride: ' + JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Accept ride error:', error);
      Alert.alert('Lỗi', 'Không thể accept ride: ' + error.message);
    }
  };

  const testRejectRide = async () => {
    if (!lastMessage || !lastMessage.requestId) {
      Alert.alert('Lỗi', 'Không có ride offer để reject');
      return;
    }

    try {
      await rideService.rejectRideRequest(
        lastMessage.requestId,
        'Test rejection'
      );
      
      Alert.alert('Thành công', 'Đã reject ride');
    } catch (error) {
      console.error('Reject ride error:', error);
      Alert.alert('Lỗi', 'Không thể reject ride: ' + error.message);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#2196F3', '#1976D2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Test</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon name="wifi" size={24} color={getStatusColor()} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {connectionStatus.toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.connectButton]}
              onPress={connectWebSocket}
              disabled={connectionStatus === 'connected'}
            >
              <Text style={styles.buttonText}>Kết nối</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]}
              onPress={disconnectWebSocket}
              disabled={connectionStatus === 'disconnected'}
            >
              <Text style={styles.buttonText}>Ngắt kết nối</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Last Message */}
        <View style={styles.messageCard}>
          <Text style={styles.cardTitle}>Tin nhắn cuối cùng:</Text>
          {lastMessage ? (
            <View style={styles.messageContent}>
              <Text style={styles.messageText}>
                {JSON.stringify(lastMessage, null, 2)}
              </Text>
            </View>
          ) : (
            <Text style={styles.noMessageText}>Chưa có tin nhắn nào</Text>
          )}
        </View>

        {/* Action Buttons */}
        {lastMessage && (
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Hành động:</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.acceptButton]}
                onPress={testAcceptRide}
              >
                <Icon name="check" size={20} color="#fff" />
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.rejectButton]}
                onPress={testRejectRide}
              >
                <Icon name="close" size={20} color="#fff" />
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* WebSocket Test Panel */}
        <WebSocketTestPanel />

        {/* FCM Test Panel */}
        <FCMTestPanel />

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.cardTitle}>Hướng dẫn test:</Text>
          <Text style={styles.instructionText}>
            1. Bấm "Kết nối" để kết nối WebSocket{'\n'}
            2. Initialize FCM và register token{'\n'}
            3. Từ rider app, đặt một chuyến xe{'\n'}
            4. Driver sẽ nhận được ride offer{'\n'}
            5. Bấm "Accept" hoặc "Reject" để phản hồi{'\n'}
            6. Khi ride bắt đầu, sẽ nhận START_TRACKING push{'\n'}
            7. GPS tracking sẽ tự động bắt đầu
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  messageContent: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  messageText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  noMessageText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default DriverTestScreen;