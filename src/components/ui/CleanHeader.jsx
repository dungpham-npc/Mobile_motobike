import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CleanHeader = ({ title, subtitle, onBellPress, badgeCount = 0 }) => {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {onBellPress && (
        <TouchableOpacity onPress={onBellPress} style={styles.bell}>
          <Icon name="notifications" size={22} color="#111827" />
          {badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  subtitle: { color: '#6B7280', fontSize: 14 },
  title: { color: '#111827', fontSize: 24, fontWeight: '700', marginTop: 6 },
  bell: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute',
    right: 4,
    top: 4,
    backgroundColor: '#F87171',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default CleanHeader;

