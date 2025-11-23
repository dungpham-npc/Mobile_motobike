import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import notificationService from '../../services/notificationService';
import { colors } from '../../theme/designTokens';

const PAGE_SIZE = 20;

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const typeIconMap = {
  RIDE_UPDATE: 'directions-bike',
  PAYMENT: 'paid',
  PROMOTION: 'local-offer',
  SYSTEM: 'info',
  DEFAULT: 'notifications',
};

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const extractItems = (response) => {
    if (!response) {
      return { items: [], pagination: null };
    }
    const items = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.content)
      ? response.content
      : response.notifications || [];
    const pagination = response.pagination || response.metadata || null;
    return { items, pagination };
  };

  const loadNotifications = useCallback(
    async (pageToLoad = 0, append = false) => {
      try {
        if (!append) {
          setLoading(true);
        }
        const response = await notificationService.getNotifications(
          pageToLoad,
          PAGE_SIZE
        );
        const { items, pagination } = extractItems(response);

        setNotifications((prev) =>
          append ? [...prev, ...items] : items
        );

        if (pagination) {
          const currentPage = pagination.page ?? pagination.currentPage ?? pageToLoad + 1;
          const totalPages = pagination.totalPages ?? 1;
          setHasMore(currentPage < totalPages);
          setPage(pageToLoad);
        } else {
          setHasMore(items.length === PAGE_SIZE);
          setPage(pageToLoad);
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
        Alert.alert('Lỗi', 'Không thể tải thông báo. Vui lòng thử lại.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNotifications(0, false);
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications(0, false);
    }, [loadNotifications])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications(0, false);
  };

  const loadMore = () => {
    if (loading || !hasMore) return;
    loadNotifications(page + 1, true);
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.notifId === notifId ? { ...item, isRead: true } : item
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      Alert.alert('Lỗi', 'Không thể đánh dấu đã đọc.');
    }
  };

  const handleDeleteNotification = async (notifId) => {
    try {
      await notificationService.deleteNotification(notifId);
      setNotifications((prev) =>
        prev.filter((item) => item.notifId !== notifId)
      );
    } catch (error) {
      console.error('Failed to delete notification:', error);
      Alert.alert('Lỗi', 'Không thể xóa thông báo.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      Alert.alert('Lỗi', 'Không thể đánh dấu tất cả đã đọc.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDeleteAll = async () => {
    Alert.alert(
      'Xóa tất cả',
      'Bạn có chắc muốn xóa tất cả thông báo?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.deleteAllNotifications();
              setNotifications([]);
            } catch (error) {
              console.error('Failed to delete all notifications:', error);
              Alert.alert('Lỗi', 'Không thể xóa tất cả thông báo.');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item.notifId);
    }
    Alert.alert(item.title || 'Thông báo', item.message || 'Không có nội dung');
  };

  const renderNotification = ({ item }) => {
    const iconName =
      typeIconMap[item.type] || typeIconMap.DEFAULT;
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.isRead && styles.notificationCardUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationTitleRow}>
            <View style={styles.iconWrapper}>
              <Icon
                name={iconName}
                size={20}
                color={item.isRead ? '#4B5563' : colors.primary}
              />
            </View>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.notificationTitle,
                  !item.isRead && styles.notificationTitleUnread,
                ]}
              >
                {item.title || 'Thông báo'}
              </Text>
              <Text style={styles.notificationTime}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        {item.message ? (
          <Text style={styles.notificationMessage}>{item.message}</Text>
        ) : null}
        <View style={styles.notificationActions}>
          {!item.isRead && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMarkAsRead(item.notifId)}
            >
              <Icon name="done" size={16} color={colors.primary} />
              <Text style={styles.actionText}>Đánh dấu đã đọc</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteNotification(item.notifId)}
          >
            <Icon name="delete" size={16} color="#EF4444" />
            <Text style={[styles.actionText, styles.deleteText]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity
          onPress={handleDeleteAll}
          style={styles.clearAllButton}
        >
          <Icon name="delete-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllRead}
          disabled={markingAll}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="done-all" size={18} color="#fff" />
              <Text style={styles.markAllText}>Đánh dấu tất cả đã đọc</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="notifications-none" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
          <Text style={styles.emptySubtitle}>
            Các cập nhật quan trọng sẽ hiển thị tại đây.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.notifId)}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerPlaceholder: {
    width: 40,
  },
  clearAllButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  actionsRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },
  markAllText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  notificationCardUnread: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDF4',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  notificationTitleUnread: {
    color: colors.primary,
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteText: {
    color: '#EF4444',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoading: {
    paddingVertical: 16,
  },
});

export default NotificationsScreen;
