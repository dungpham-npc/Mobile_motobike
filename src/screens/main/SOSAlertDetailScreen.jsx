import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import sosService from '../../services/sosService';
import goongService from '../../services/goongService';

const { width } = Dimensions.get('window');

const SOSAlertDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { alertId } = route.params;
  const [alert, setAlert] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const loadAlertDetails = async () => {
    try {
      const alertData = await sosService.getAlert(alertId);
      setAlert(alertData);
      if (alertData.timeline) {
        setTimeline(alertData.timeline);
      }
    } catch (error) {
      console.error('Failed to load alert details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlertDetails();

    // Auto-refresh mỗi 15s nếu alert ACTIVE hoặc ESCALATED
    const interval = setInterval(() => {
      if (alert && (alert.status === 'ACTIVE' || alert.status === 'ESCALATED')) {
        loadAlertDetails();
      }
    }, 15000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [alertId, alert?.status]);

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
    return date.toLocaleString(); // hiển thị ISO UTC, không convert sang giờ VN
  };

  const formatDescription = (text) => {
    if (!text) return '';
    const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;
    return text.replace(isoPattern, (match) => {
      const d = new Date(match);
      return d.toLocaleString();
    });
  };

  const openGoogleMaps = () => {
    if (alert?.currentLat && alert?.currentLng) {
      const url = `https://maps.google.com/?q=${alert.currentLat},${alert.currentLng}`;
      Linking.openURL(url);
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'CREATED':
        return 'flag';
      case 'ORIGINATOR_NOTIFIED':
        return 'notifications';
      case 'CONTACT_NOTIFIED':
        return 'phone';
      case 'ADMIN_NOTIFIED':
        return 'supervisor-account';
      case 'ESCALATED':
        return 'warning';
      case 'ACKNOWLEDGED':
        return 'check-circle';
      case 'RESOLVED':
        return 'check-circle';
      case 'CAMPUS_SECURITY_NOTIFIED':
        return 'security';
      default:
        return 'info';
    }
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'CREATED':
        return '#3B82F6';
      case 'ESCALATED':
        return '#F59E0B';
      case 'ACKNOWLEDGED':
        return '#3B82F6';
      case 'RESOLVED':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const parseContactInfo = (contactInfoString) => {
    try {
      return JSON.parse(contactInfoString || '[]');
    } catch {
      return [];
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Profile');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <SoftBackHeader title="Chi tiết cảnh báo" onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!alert) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <SoftBackHeader title="Chi tiết cảnh báo" onBackPress={() => navigation.goBack()}/>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Không tìm thấy cảnh báo</Text>
        </View>
      </SafeAreaView>
    );
  }

  const contacts = parseContactInfo(alert.contactInfo);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SoftBackHeader title="Chi tiết cảnh báo"onBackPress={() => navigation.goBack()}  />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Header Card */}
        <Animatable.View animation="fadeInDown" style={styles.headerCard}>
          <LinearGradient
            colors={[getStatusColor(alert.status), getStatusColor(alert.status) + 'DD']}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <Icon name="warning" size={40} color="#fff" />
              <Text style={styles.alertTitle}>Cảnh báo SOS #{alert.sosId}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{getStatusLabel(alert.status)}</Text>
              </View>
              {alert.escalationCount > 0 && (
                <View style={styles.escalationBadge}>
                  <Icon name="arrow-upward" size={16} color="#FFF" />
                  <Text style={styles.escalationText}>
                    Escalation: {alert.escalationCount} lần
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* User Information */}
        <Animatable.View animation="fadeInUp" delay={100} style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="person" size={24} color="#3B82F6" />
            <Text style={styles.cardTitle}>Thông tin người dùng</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Người kích hoạt:</Text>
              <Text style={styles.infoValue}>{alert.triggeredByName || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Số điện thoại:</Text>
              <Text style={styles.infoValue}>{alert.triggeredByPhone || 'N/A'}</Text>
            </View>
            {alert.driverPhone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tài xế:</Text>
                <Text style={styles.infoValue}>{alert.driverPhone}</Text>
              </View>
            )}
          </View>
        </Animatable.View>

        {/* Location Information */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="location-on" size={24} color="#EF4444" />
            <Text style={styles.cardTitle}>Vị trí</Text>
          </View>
          <View style={styles.cardContent}>
            {alert.currentLat && alert.currentLng ? (
              <>
                {goongService.isMapsConfigured() ? (
                  <View style={styles.mapContainer}>
                    <WebView
                      source={{
                        html: `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <script src="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js"></script>
                              <link href="https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css" rel="stylesheet" />
                              <style>
                                body { margin: 0; padding: 0; }
                                #map { width: 100%; height: 100%; }
                              </style>
                            </head>
                            <body>
                              <div id="map"></div>
                              <script>
                                goongjs.accessToken = '${goongService.mapsApiKey}';
                                const map = new goongjs.Map({
                                  container: 'map',
                                  style: 'https://tiles.goong.io/assets/goong_map_web.json?api_key=${goongService.mapsApiKey}',
                                  center: [${alert.currentLng}, ${alert.currentLat}],
                                  zoom: 15
                                });
                                new goongjs.Marker({ color: '#EF4444' })
                                  .setLngLat([${alert.currentLng}, ${alert.currentLat}])
                                  .setPopup(new goongjs.Popup().setHTML('<b>Vị trí SOS</b>'))
                                  .addTo(map);
                              </script>
                            </body>
                          </html>
                        `,
                      }}
                      style={styles.map}
                      scrollEnabled={false}
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                    />
                  </View>
                ) : (
                  <View style={styles.mapPlaceholder}>
                    <Icon name="location-on" size={48} color="#EF4444" />
                    <Text style={styles.mapPlaceholderText}>Vị trí SOS</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tọa độ:</Text>
                  <Text style={styles.infoValue}>
                    {alert.currentLat.toFixed(6)}, {alert.currentLng.toFixed(6)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.mapButton} onPress={openGoogleMaps}>
                  <Icon name="map" size={20} color="#fff" />
                  <Text style={styles.mapButtonText}>Mở Google Maps</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noDataText}>Không có thông tin vị trí</Text>
            )}
          </View>
        </Animatable.View>

        {/* Time Information */}
        <Animatable.View animation="fadeInUp" delay={300} style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="access-time" size={24} color="#F59E0B" />
            <Text style={styles.cardTitle}>Thời gian</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tạo lúc:</Text>
              <Text style={styles.infoValue}>{formatDateTime(alert.createdAt)}</Text>
            </View>
            {alert.acknowledgedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Xác nhận lúc:</Text>
                <Text style={styles.infoValue}>{formatDateTime(alert.acknowledgedAt)}</Text>
              </View>
            )}
            {alert.resolvedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Giải quyết lúc:</Text>
                <Text style={styles.infoValue}>{formatDateTime(alert.resolvedAt)}</Text>
              </View>
            )}
          </View>
        </Animatable.View>

        {/* Emergency Contacts */}
        {contacts.length > 0 && (
          <Animatable.View animation="fadeInUp" delay={400} style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="contacts" size={24} color="#10B981" />
              <Text style={styles.cardTitle}>Liên hệ khẩn cấp</Text>
            </View>
            <View style={styles.cardContent}>
              {contacts.map((contact, index) => (
                <View key={index} style={styles.contactItem}>
                  <View style={styles.contactIcon}>
                    <Icon name="phone" size={20} color="#10B981" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>
                      {contact.name || 'N/A'}
                      {contact.primary && (
                        <Text style={styles.primaryBadge}> (Chính)</Text>
                      )}
                    </Text>
                    <Text style={styles.contactPhone}>{contact.phone || 'N/A'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animatable.View>
        )}

        {/* Description */}
        {alert.description && (
          <Animatable.View animation="fadeInUp" delay={500} style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="description" size={24} color="#6B7280" />
              <Text style={styles.cardTitle}>Mô tả</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.descriptionText}>{formatDescription(alert.description)}</Text>
            </View>
          </Animatable.View>
        )}

        {/* Timeline */}
        <Animatable.View animation="fadeInUp" delay={600} style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="timeline" size={24} color="#9C27B0" />
            <Text style={styles.cardTitle}>Dòng thời gian</Text>
          </View>
          <View style={styles.cardContent}>
            {timeline.length > 0 ? (
              timeline.slice(0, 15).map((event, index) => (
                <View key={event.eventId || index} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineIcon,
                      { backgroundColor: getEventColor(event.eventType) },
                    ]}
                  >
                    <Icon name={getEventIcon(event.eventType)} size={16} color="#fff" />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDescription}>{event.description}</Text>
                    <Text style={styles.timelineTime}>{formatDateTime(event.createdAt)}</Text>
                    {event.metadata && (
                      <Text style={styles.timelineMetadata}>{event.metadata}</Text>
                    )}
                  </View>
                  {index < timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>Không có sự kiện nào</Text>
            )}
          </View>
        </Animatable.View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
  },
  headerCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerGradient: {
    padding: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  escalationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  escalationText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 12,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
  },
  map: {
    flex: 1,
    borderRadius: 12,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mapPlaceholderText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#991B1B',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  mapButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  primaryBadge: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  contactPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  timelineItem: {
    position: 'relative',
    paddingLeft: 40,
    marginBottom: 16,
  },
  timelineIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineDescription: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timelineMetadata: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 36,
    width: 2,
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
});

export default SOSAlertDetailScreen;

