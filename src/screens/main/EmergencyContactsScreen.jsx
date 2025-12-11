import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import ModernButton from '../../components/ModernButton';
import sosService from '../../services/sosService';

const EmergencyContactsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    relationship: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadContacts = async () => {
    try {
      const response = await sosService.getContacts();
      setContacts(response || []);
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách liên hệ khẩn cấp');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [])
  );

  const openAddForm = () => {
    setEditingContact(null);
    setFormData({ name: '', phone: '', relationship: '' });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      phone: contact.phone || '',
      relationship: contact.relationship || '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Vui lòng nhập tên';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^[0-9]{9,11}$/.test(formData.phone.trim())) {
      errors.phone = 'Số điện thoại phải từ 9 đến 11 chữ số';
    }

    if (!formData.relationship.trim()) {
      errors.relationship = 'Vui lòng nhập mối quan hệ';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        relationship: formData.relationship.trim(),
      };

      if (editingContact) {
        await sosService.updateContact(editingContact.contactId, payload);
        Alert.alert('Thành công', 'Đã cập nhật liên hệ khẩn cấp');
      } else {
        await sosService.createContact(payload);
        Alert.alert('Thành công', 'Đã thêm liên hệ khẩn cấp');
      }

      setFormOpen(false);
      loadContacts();
    } catch (error) {
      console.error('Failed to save contact:', error);
      Alert.alert('Lỗi', error?.message || 'Không thể lưu liên hệ khẩn cấp');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa liên hệ "${contact.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await sosService.deleteContact(contact.contactId);
              Alert.alert('Thành công', 'Đã xóa liên hệ khẩn cấp');
              loadContacts();
            } catch (error) {
              console.error('Failed to delete contact:', error);
              Alert.alert('Lỗi', 'Không thể xóa liên hệ khẩn cấp');
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (contact) => {
    try {
      await sosService.setPrimaryContact(contact.contactId);
      Alert.alert('Thành công', 'Đã đặt làm liên hệ chính');
      loadContacts();
    } catch (error) {
      console.error('Failed to set primary contact:', error);
      Alert.alert('Lỗi', 'Không thể đặt làm liên hệ chính');
    }
  };

  const renderContactCard = (contact, index) => (
    <Animatable.View
      key={contact.contactId}
      animation="fadeInUp"
      delay={index * 100}
      style={[
        styles.contactCard,
        contact.primary && styles.contactCardPrimary,
      ]}
    >
      <View style={styles.contactHeader}>
        <View style={styles.contactIconContainer}>
          <LinearGradient
            colors={contact.primary ? ['#10B981', '#059669'] : ['#3B82F6', '#2563EB']}
            style={styles.contactIconGradient}
          >
            <Icon name="person" size={24} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            {contact.primary && (
              <View style={styles.primaryBadge}>
                <Icon name="star" size={14} color="#F59E0B" />
                <Text style={styles.primaryText}>Chính</Text>
              </View>
            )}
          </View>
          <Text style={styles.contactPhone}>{contact.phone}</Text>
          <Text style={styles.contactRelationship}>{contact.relationship}</Text>
        </View>
      </View>

      <View style={styles.contactActions}>
        {!contact.primary && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetPrimary(contact)}
          >
            <Icon name="star-border" size={20} color="#F59E0B" />
            <Text style={styles.actionText}>Đặt chính</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditForm(contact)}
        >
          <Icon name="edit" size={20} color="#3B82F6" />
          <Text style={styles.actionText}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(contact)}
        >
          <Icon name="delete" size={20} color="#EF4444" />
          <Text style={[styles.actionText, { color: '#EF4444' }]}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Profile');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SoftBackHeader title="Liên hệ khẩn cấp" onBackPress={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!formOpen} // khi mở form, khoá scroll phần list phía trên
      >
        {/* Info Card */}
        <Animatable.View animation="fadeInDown" style={styles.infoCard}>
          <Icon name="info-outline" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            Các liên hệ này sẽ được thông báo khi bạn kích hoạt cảnh báo SOS
          </Text>
        </Animatable.View>

        {/* Add Button */}
        <Animatable.View animation="fadeIn" delay={200}>
          <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.addButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="add-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Thêm liên hệ khẩn cấp</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        {/* Contacts List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : contacts.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyState}>
            <Icon name="contacts" size={80} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Chưa có liên hệ khẩn cấp</Text>
            <Text style={styles.emptyDescription}>
              Thêm liên hệ để họ được thông báo khi bạn kích hoạt SOS
            </Text>
          </Animatable.View>
        ) : (
          <View style={styles.contactsList}>
            {contacts.map((contact, index) => renderContactCard(contact, index))}
          </View>
        )}
      </ScrollView>

      {/* Inline Add/Edit Form - avoids keyboard overlay */}
      {formOpen && (
        <Animatable.View animation="fadeInUp" style={[styles.formCard, { marginBottom: insets.bottom + 24 }]}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingContact ? 'Sửa liên hệ khẩn cấp' : 'Thêm liên hệ khẩn cấp'}
            </Text>
            <TouchableOpacity onPress={() => setFormOpen(false)}>
              <Icon name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tên liên hệ *</Text>
            <TextInput
              style={[styles.input, formErrors.name && styles.inputError]}
              placeholder="Ví dụ: Nguyễn Văn A"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              returnKeyType="next"
            />
            {formErrors.name && <Text style={styles.errorText}>{formErrors.name}</Text>}
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Số điện thoại *</Text>
            <TextInput
              style={[styles.input, formErrors.phone && styles.inputError]}
              placeholder="Ví dụ: 0987654321"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              maxLength={11}
              returnKeyType="next"
            />
            {formErrors.phone && <Text style={styles.errorText}>{formErrors.phone}</Text>}
          </View>

          {/* Relationship */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mối quan hệ *</Text>
            <TextInput
              style={[styles.input, formErrors.relationship && styles.inputError]}
              placeholder="Ví dụ: Bố/Mẹ/Anh/Chị"
              value={formData.relationship}
              onChangeText={(text) => setFormData({ ...formData, relationship: text })}
              returnKeyType="done"
            />
            {formErrors.relationship && (
              <Text style={styles.errorText}>{formErrors.relationship}</Text>
            )}
          </View>

          <View style={styles.formFooter}>
            <ModernButton
              title="Hủy"
              variant="secondary"
              onPress={() => setFormOpen(false)}
              style={styles.modalButton}
            />
            <ModernButton
              title={editingContact ? 'Cập nhật' : 'Thêm'}
              onPress={handleSave}
              loading={saving}
              style={styles.modalButton}
            />
          </View>
        </Animatable.View>
      )}
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 12,
    lineHeight: 20,
  },
  addButton: {
    borderRadius: 12,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
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
  contactsList: {
    gap: 16,
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactCardPrimary: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF3',
    shadowColor: '#10B981',
    shadowOpacity: 0.15,
  },
  contactHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  contactIconContainer: {
    marginRight: 12,
  },
  contactIconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  primaryText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    marginLeft: 4,
  },
  contactPhone: {
    fontSize: 16,
    color: '#3B82F6',
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 14,
    color: '#6B7280',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    padding: 16,
    position: "block",
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  formFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
  },
});

export default EmergencyContactsScreen;

