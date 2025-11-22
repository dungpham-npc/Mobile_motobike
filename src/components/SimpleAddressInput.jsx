import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import goongService from '../services/goongService';
import poiService from '../services/poiService';
import { locationStorageService } from '../services/locationStorageService';

const SimpleAddressInput = ({
  value,
  onChangeText,
  onLocationSelect,
  placeholder,
  iconName,
  iconColor,
  style,
  isPickupInput = false,
  currentLocation = null,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const debounceRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isTyping && value && value.length >= 2) {
      loadSuggestions(value);
    } else if (!isTyping || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, isTyping]);

  const loadSuggestions = async (query) => {
    try {
      const poiLocations = await poiService.getAllLocations();
      
      let currentLocationSuggestion = null;
      if (isPickupInput) {
        try {
          const locationData = await locationStorageService.getCurrentLocationWithAddress();
          if (locationData.location && locationData.address) {
            currentLocationSuggestion = {
              id: 'current_location',
              description: 'Vị trí hiện tại',
              main_text: 'Vị trí hiện tại',
              secondary_text: locationData.address.shortAddress || 'Sử dụng GPS để xác định vị trí',
              coordinates: locationData.location,
              isCurrentLocation: true,
              isPOI: false
            };
          }
        } catch (error) {
        }
      }

      if (query.length === 2) {
        const shortSuggestions = poiLocations.slice(0, 5).map(poi => ({
          id: poi.locationId,
          description: poi.name,
          main_text: poi.name,
          secondary_text: 'Địa điểm được đề xuất',
          coordinates: {
            latitude: poi.latitude,
            longitude: poi.longitude
          },
          locationId: poi.locationId,
          isPOI: true
        }));

        const finalSuggestions = currentLocationSuggestion 
          ? [currentLocationSuggestion, ...shortSuggestions]
          : shortSuggestions;

        setSuggestions(finalSuggestions);
        setShowSuggestions(true);
        return;
      }
      
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => {
        searchPlacesWithPOI(query, poiLocations, currentLocationSuggestion);
      }, 500);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const searchPlacesWithPOI = async (query, poiLocations, currentLocationSuggestion) => {
    if (!goongService.isPlacesConfigured()) {
      return;
    }
    
    try {
      setLoading(true);
      
      const filteredPOI = poiLocations.filter(poi =>
        poi.name.toLowerCase().includes(query.toLowerCase())
      ).map(poi => ({
        id: poi.locationId,
        description: poi.name,
        main_text: poi.name,
        secondary_text: 'Địa điểm được đề xuất',
        coordinates: {
          latitude: poi.latitude,
          longitude: poi.longitude
        },
        locationId: poi.locationId,
        isPOI: true
      }));

      const results = await goongService.searchPlaces(query);
      const predictions = Array.isArray(results) ? results : results?.predictions || [];
      
      const searchResults = predictions.map(item => ({
        id: item.place_id || item.placeId,
        description: item.description,
        main_text: item.structured_formatting?.main_text || item.description,
        secondary_text: item.structured_formatting?.secondary_text || '',
        place_id: item.place_id || item.placeId,
        isPOI: false
      }));

      const currentLocationItems = [];
      if (currentLocationSuggestion && 
          ('vị trí hiện tại'.includes(query.toLowerCase()) || 
           'hiện tại'.includes(query.toLowerCase()) ||
           'current'.includes(query.toLowerCase()))) {
        currentLocationItems.push(currentLocationSuggestion);
      }
      
      const combinedResults = [
        ...currentLocationItems,
        ...filteredPOI,
        ...searchResults
      ].slice(0, 8);
      
      setSuggestions(combinedResults);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Search places error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = async (suggestion) => {
    try {
      setIsTyping(false);
      setShowModal(false);
      setShowSuggestions(false);
      
      if (suggestion.isPOI && suggestion.locationId) {
        const displayText = suggestion.main_text || suggestion.description;
        const locationData = {
          latitude: suggestion.coordinates.latitude,
          longitude: suggestion.coordinates.longitude,
          address: displayText,
          locationId: suggestion.locationId,
          isPOI: true,
        };
        onChangeText(displayText);
        onLocationSelect(locationData);
        setSuggestions([]);
        return;
      }
      
      if (suggestion.isCurrentLocation && suggestion.coordinates) {
        const displayText = suggestion.main_text || suggestion.description;
        const locationData = {
          latitude: suggestion.coordinates.latitude,
          longitude: suggestion.coordinates.longitude,
          address: displayText,
          isCurrentLocation: true,
        };
        onChangeText(displayText);
        onLocationSelect(locationData);
        setSuggestions([]);
        return;
      }
      
      const placeId = suggestion.place_id || suggestion.id;
      
      try {
        const placeDetails = await goongService.getPlaceDetails(placeId);
        
        if (placeDetails && placeDetails.geometry && placeDetails.geometry.location) {
          const location = placeDetails.geometry.location;
          const displayText = suggestion.main_text || suggestion.description;
          const fullAddress = placeDetails.formattedAddress || displayText;
          const locationData = {
            latitude: location.latitude,
            longitude: location.longitude,
            address: fullAddress,
          };
          onChangeText(displayText);
          onLocationSelect(locationData);
        } else {
          const displayText = suggestion.main_text || suggestion.description;
          const geocodeResults = await goongService.geocode(displayText);
          
          if (geocodeResults && geocodeResults.geometry && geocodeResults.geometry.location) {
            const location = geocodeResults.geometry.location;
            const locationData = {
              latitude: location.latitude,
              longitude: location.longitude,
              address: displayText,
            };
            onChangeText(displayText);
            onLocationSelect(locationData);
          } else {
            console.error('❌ Both place details and geocode failed');
            // Fallback: just set the text
            const displayText = suggestion.main_text || suggestion.description;
            onChangeText(displayText);
          }
        }
      } catch (error) {
        console.error('❌ Error in place details/geocode:', error);
        // Fallback: just set the text
        const displayText = suggestion.main_text || suggestion.description;
        onChangeText(displayText);
      }
      
      setSuggestions([]);
    } catch (error) {
      console.error('Get place details error:', error);
      const displayText = suggestion.main_text || suggestion.description;
      onChangeText(displayText);
      setShowModal(false);
      setShowSuggestions(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <Icon name={iconName} size={20} color={iconColor} />
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={(text) => {
            setIsTyping(true);
            onChangeText(text);
          }}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color="#666" style={styles.loadingIcon} />
        )}
        {/* Show suggestions button only when there are suggestions and user is focused */}
        {showSuggestions && suggestions.length > 0 && isFocused && (
          <TouchableOpacity 
            style={styles.suggestionsButton}
            onPress={() => setShowModal(true)}
          >
            <Icon name="expand-more" size={20} color="#666" />
            <Text style={styles.suggestionsCount}>{suggestions.length}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Modal for suggestions to avoid nested VirtualizedLists */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.suggestionsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn địa điểm</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.suggestionsList} nestedScrollEnabled={true}>
              {suggestions.map((item, index) => (
                <TouchableOpacity
                  key={item.id || index}
                  style={styles.suggestionItem}
                  onPress={() => handleSuggestionPress(item)}
                >
                  <Icon 
                    name={
                      item.isCurrentLocation ? "my-location" : 
                      item.isPOI ? "place" : "location-on"
                    } 
                    size={20} 
                    color={
                      item.isCurrentLocation ? "#4CAF50" : 
                      item.isPOI ? "#2196F3" : "#666"
                    } 
                    style={styles.suggestionIcon} 
                  />
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionMain} numberOfLines={1}>
                      {item.main_text || item.description}
                    </Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {item.secondary_text || ''}
                    </Text>
                  </View>
                  {item.isPOI && (
                    <View style={styles.poiBadge}>
                      <Text style={styles.poiBadgeText}>POI</Text>
                    </View>
                  )}
                  {item.isCurrentLocation && (
                    <View style={styles.currentLocationBadge}>
                      <Text style={styles.currentLocationBadgeText}>GPS</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 5,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  loadingIcon: {
    marginLeft: 8,
  },
  suggestionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    marginLeft: 8,
  },
  suggestionsCount: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  suggestionsModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '70%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  suggestionsList: {
    maxHeight: 400,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  suggestionSecondary: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  poiBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  poiBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  currentLocationBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  currentLocationBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});

export default SimpleAddressInput;
