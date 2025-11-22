import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import goongService from '../services/goongService';
import addressValidation from '../utils/addressValidation';
import poiService from '../services/poiService';
import { locationStorageService } from '../services/locationStorageService';

const AddressInput = ({
  value,
  onChangeText,
  onLocationSelect,
  placeholder,
  iconName,
  iconColor,
  style,
  isPickupInput = false, // New prop to identify pickup input
  currentLocation = null, // Current user location
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const selectingRef = useRef(false); // Track if we're selecting a suggestion

  // Separate state to track if user is actively typing
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Only search if user is actively typing, not when value is set programmatically
    if (isTyping && value && value.length > 0 && !selectingRef.current) {
      loadSuggestions(value);
    } else if (!isTyping && !selectingRef.current) {
      // Don't show suggestions when value is set programmatically
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
      // Get POI locations from admin
      const poiLocations = await poiService.getAllLocations();
      
      // Get current location with address if it's pickup input
      let currentLocationSuggestion = null;
      if (isPickupInput) {
        try {
          const locationData = await locationStorageService.getCurrentLocationWithAddress();
          if (locationData.location && locationData.address) {
            currentLocationSuggestion = {
              place_id: 'current_location',
              description: 'Vị trí hiện tại',
              structured_formatting: {
                main_text: 'Vị trí hiện tại',
                secondary_text: locationData.address.shortAddress || 'Sử dụng GPS để xác định vị trí'
              },
              coordinates: locationData.location,
              isSuggested: true,
              isCurrentLocation: true,
              isPOI: false
            };
          }
        } catch (error) {
        }
      }

      if (query.length <= 2) {
        // Show POI locations and current location for short queries
        const shortSuggestions = poiLocations.map(poi => ({
          place_id: poi.locationId,
          description: poi.name,
          structured_formatting: {
            main_text: poi.name,
            secondary_text: 'Địa điểm được đề xuất'
          },
          coordinates: {
            latitude: poi.latitude,
            longitude: poi.longitude
          },
          locationId: poi.locationId,
          isSuggested: true,
          isPOI: true
        }));

        // Add current location at the top for pickup input
        const finalSuggestions = currentLocationSuggestion 
          ? [currentLocationSuggestion, ...shortSuggestions]
          : shortSuggestions;

        setSuggestions(finalSuggestions);
        setShowSuggestions(true);
        return;
      }
      
      // Debounce search for longer queries
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => {
        searchPlacesWithPOI(query, poiLocations, currentLocationSuggestion);
      }, 300);
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
      
      // Filter POI locations based on query
      const filteredPOI = poiLocations.filter(poi =>
        poi.name.toLowerCase().includes(query.toLowerCase())
      ).map(poi => ({
        place_id: poi.locationId,
        description: poi.name,
        structured_formatting: {
          main_text: poi.name,
          secondary_text: 'Địa điểm được đề xuất'
        },
        coordinates: {
          latitude: poi.latitude,
          longitude: poi.longitude
        },
        locationId: poi.locationId,
        isSuggested: true,
        isPOI: true,
        isValid: true
      }));

      // Search Goong API
      const results = await goongService.searchPlaces(query);
      const predictions = Array.isArray(results) ? results : results?.predictions || [];
      
      const searchResults = predictions.map(item => ({
        ...item,
        place_id: item.place_id || item.placeId,
        structured_formatting: item.structured_formatting || item.structuredFormatting,
        isValid: true,
        isPOI: false
      }));

      // Add current location if query matches
      const currentLocationItems = [];
      if (currentLocationSuggestion && 
          ('vị trí hiện tại'.includes(query.toLowerCase()) || 
           'hiện tại'.includes(query.toLowerCase()) ||
           'current'.includes(query.toLowerCase()))) {
        currentLocationItems.push(currentLocationSuggestion);
      }
      
      // Combine results: Current Location -> POI -> Goong API results
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
      console.log('Suggestion pressed:', suggestion);
      selectingRef.current = true; // Mark that we're selecting
      setShowSuggestions(false); // Hide suggestions immediately to prevent onBlur from interfering
      
      // Get display text first
      const displayText = suggestion.structured_formatting?.main_text || suggestion.description;
      console.log('Setting display text:', displayText);
      
      // Set the text immediately BEFORE setting isTyping to false
      onChangeText(displayText);
      
      // Small delay to ensure onChangeText completes before we stop typing detection
      setTimeout(() => {
        setIsTyping(false); // Stop triggering search when setting value programmatically
      }, 100);
      
      // If it's a POI location, use POI data directly
      if (suggestion.isPOI && suggestion.locationId) {
        const displayText = suggestion.structured_formatting?.main_text || suggestion.description;
        // Call onLocationSelect FIRST to set flag before onChangeText
        onLocationSelect({
          latitude: suggestion.coordinates.latitude,
          longitude: suggestion.coordinates.longitude,
          address: displayText,
          locationId: suggestion.locationId,
          isPOI: true,
        });
        onChangeText(displayText);
        setShowSuggestions(false);
        setSuggestions([]);
        selectingRef.current = false;
        return;
      }
      
      // If it's current location, use coordinates directly
      if (suggestion.isCurrentLocation && suggestion.coordinates) {
        const displayText = suggestion.structured_formatting?.main_text || suggestion.description;
        // Call onLocationSelect FIRST to set flag before onChangeText
        onLocationSelect({
          latitude: suggestion.coordinates.latitude,
          longitude: suggestion.coordinates.longitude,
          address: displayText,
          isCurrentLocation: true,
        });
        onChangeText(displayText);
        setShowSuggestions(false);
        setSuggestions([]);
        selectingRef.current = false;
        return;
      }
      
      // For Goong API results, get place details
      const placeId = suggestion.place_id || suggestion.placeId;
      const placeDetails = await goongService.getPlaceDetails(placeId);
      
      if (placeDetails && placeDetails.geometry && placeDetails.geometry.location) {
        const location = placeDetails.geometry.location;
        // Use FULL formatted address from Goong for better accuracy
        const fullAddress = placeDetails.formattedAddress || suggestion.description;
        
        // Call onLocationSelect FIRST to set flag before onChangeText
        onLocationSelect({
          latitude: location.latitude,
          longitude: location.longitude,
          address: fullAddress,
        });
        onChangeText(fullAddress);
      } else {
        // Fallback to geocoding if place details fail
        const fullAddress = suggestion.description || suggestion.structured_formatting?.main_text;
        const geocodeResults = await goongService.geocode(fullAddress);
        if (geocodeResults && geocodeResults.results && geocodeResults.results.length > 0) {
          const location = geocodeResults.results[0].geometry.location;
          // Call onLocationSelect FIRST to set flag before onChangeText
          onLocationSelect({
            latitude: location.lat,
            longitude: location.lng,
            address: fullAddress,
          });
          onChangeText(fullAddress);
        } else {
          console.error('❌ Failed to get coordinates for address:', fullAddress);
        }
      }
      
      // Ensure text stays set after async operations
      setTimeout(() => {
        onChangeText(displayText);
      }, 50);
      
      setSuggestions([]);
      selectingRef.current = false;
    } catch (error) {
      console.error('❌ Get place details error:', error);
      // Fallback: just set the text with proper display name
      const displayText = suggestion.structured_formatting?.main_text || suggestion.description;
      onChangeText(displayText);
      setShowSuggestions(false);
      selectingRef.current = false;
    }
  };

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.suggestionItem,
        item.isSuggested && styles.suggestedItem,
        item.isValid === false && styles.invalidItem
      ]}
      onPress={() => {
        handleSuggestionPress(item);
      }}
    >
      <Icon 
        name={
          item.isCurrentLocation ? "my-location" : 
          item.isPOI ? "place" : 
          item.isSuggested ? "star" : 
          item.isValid === false ? "warning" : "location-on"
        } 
        size={20} 
        color={
          item.isCurrentLocation ? "#4CAF50" : 
          item.isPOI ? "#2196F3" : 
          item.isSuggested ? "#FF9800" : "#666"
        } 
        style={styles.suggestionIcon} 
      />
      <View style={styles.suggestionContent}>
        <Text style={[
          styles.suggestionMain,
          item.isSuggested && styles.suggestedText
        ]} numberOfLines={1}>
          {item.structured_formatting?.main_text || item.description}
        </Text>
        <Text style={styles.suggestionSecondary} numberOfLines={1}>
          {item.structured_formatting?.secondary_text || ''}
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
      {item.isSuggested && !item.isPOI && !item.isCurrentLocation && (
        <View style={styles.suggestedBadge}>
          <Text style={styles.suggestedBadgeText}>Gợi ý</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <Icon name={iconName} size={20} color={iconColor} />
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={(text) => {
            if (!selectingRef.current) {
              setIsTyping(true); // User is actively typing
            }
            onChangeText(text);
          }}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Hide suggestions when input loses focus (with delay to allow selection)
            setTimeout(() => {
              if (!selectingRef.current) {
                setShowSuggestions(false);
              }
            }, 300);
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color="#666" style={styles.loadingIcon} />
        )}
      </View>
      
      {showSuggestions && suggestions.length > 0 && (
        <View 
          style={styles.suggestionsContainer}
          onStartShouldSetResponder={() => {
            console.log('Container should set responder');
            return true;
          }}
          onMoveShouldSetResponder={() => false}
          onResponderGrant={() => {
            console.log('Container responder granted');
          }}
        >
          {suggestions.map((item, index) => {
            const displayText = item.structured_formatting?.main_text || item.description;
            console.log('Rendering suggestion:', displayText, 'index:', index);
            return (
              <Pressable
                key={item.place_id || item.description || index}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  item.isSuggested && styles.suggestedItem,
                  item.isValid === false && styles.invalidItem,
                  pressed && styles.suggestionItemPressed
                ]}
                onPress={() => {
                  console.log('Pressable pressed:', displayText);
                  handleSuggestionPress(item);
                }}
                onPressIn={() => {
                  console.log('Pressable onPressIn for:', displayText);
                  selectingRef.current = true;
                }}
                onPressOut={() => {
                  console.log('Pressable onPressOut');
                }}
              >
                <Icon 
                  name={
                    item.isCurrentLocation ? "my-location" : 
                    item.isPOI ? "place" : 
                    item.isSuggested ? "star" : 
                    item.isValid === false ? "warning" : "location-on"
                  } 
                  size={20} 
                  color={
                    item.isCurrentLocation ? "#4CAF50" : 
                    item.isPOI ? "#2196F3" : 
                    item.isSuggested ? "#FF9800" : "#666"
                  } 
                  style={styles.suggestionIcon} 
                />
                <View style={styles.suggestionContent}>
                  <Text style={[
                    styles.suggestionMain,
                    item.isSuggested && styles.suggestedText
                  ]} numberOfLines={1}>
                    {displayText}
                  </Text>
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || ''}
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
                {item.isSuggested && !item.isPOI && !item.isCurrentLocation && (
                  <View style={styles.suggestedBadge}>
                    <Text style={styles.suggestedBadgeText}>Gợi ý</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  textInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#1e293b',
    paddingVertical: 0,
  },
  loadingIcon: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    maxHeight: 280,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
    overflow: 'hidden',
  },
  suggestionsList: {
    borderRadius: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
  },
  suggestionIcon: {
    marginRight: 14,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#1e293b',
    marginBottom: 2,
  },
  suggestionSecondary: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#64748b',
    marginTop: 2,
  },
  // New styles for suggested items
  suggestedItem: {
    backgroundColor: 'rgba(255,152,0,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#F97316',
  },
  suggestedText: {
    color: '#EA580C',
    fontFamily: 'Inter_600SemiBold',
  },
  suggestedBadge: {
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  suggestedBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  // POI badge styles
  poiBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  poiBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  // Current location badge styles
  currentLocationBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  currentLocationBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  // Styles for invalid items
  invalidItem: {
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  invalidText: {
    color: '#DC2626',
    fontFamily: 'Inter_500Medium',
  },
  invalidSecondary: {
    color: '#F87171',
  },
  invalidBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  invalidBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});

export default AddressInput;
