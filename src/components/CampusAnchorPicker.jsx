import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CampusAnchorPicker = ({
  value,
  onLocationSelect,
  placeholder,
  iconName,
  iconColor,
  style,
  options = [],
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleSelect = (location) => {
    onLocationSelect(location);
    setShowPicker(false);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Icon name={iconName || "location-on"} size={20} color={iconColor || "#666"} />
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {value || placeholder || "Chọn địa điểm"}
        </Text>
        <Icon name="arrow-drop-down" size={24} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn địa điểm</Text>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item, index) => item.locationId?.toString() || item.id?.toString() || index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    value === item.name && styles.optionItemSelected
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Icon 
                    name="location-on" 
                    size={20} 
                    color={value === item.name ? iconColor || "#4CAF50" : "#666"} 
                  />
                  <Text style={[
                    styles.optionText,
                    value === item.name && styles.optionTextSelected
                  ]}>
                    {item.name || item.address}
                  </Text>
                  {value === item.name && (
                    <Icon name="check-circle" size={20} color={iconColor || "#4CAF50"} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="location-off" size={40} color="#ccc" />
                  <Text style={styles.emptyText}>Không có địa điểm nào</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
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
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionItemSelected: {
    backgroundColor: '#f0f8f0',
  },
  optionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
});

export default CampusAnchorPicker;

