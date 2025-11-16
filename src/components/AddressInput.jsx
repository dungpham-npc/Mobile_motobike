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
          console.warn('Could not load current location:', error);
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
      console.log('Goong Places API not configured');
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
        onLocationSelect({
          latitude: suggestion.coordinates.latitude,
          longitude: suggestion.coordinates.longitude,
          address: displayText,
          locationId: suggestion.locationId,
          isPOI: true,
        });
        setSuggestions([]);
        selectingRef.current = false;
        return;
      }
      
      // If it's current location, use coordinates directly
      if (suggestion.isCurrentLocation && suggestion.coordinates) {
        onLocationSelect({
          latitude: suggestion.coordinates.latitude,
          longitude: suggestion.coordinates.longitude,
          address: displayText,
          isCurrentLocation: true,
        });
        setSuggestions([]);
        selectingRef.current = false;
        return;
      }
      
      // For Goong API results, get place details
      const placeId = suggestion.place_id || suggestion.placeId;
      const placeDetails = await goongService.getPlaceDetails(placeId);
      
      if (placeDetails && placeDetails.result) {
        const location = placeDetails.result.geometry.location;
        const fullAddress = placeDetails.result.formatted_address || displayText;
        
        // Call onLocationSelect with displayText so parent doesn't overwrite the input
        onLocationSelect({
          latitude: location.lat,
          longitude: location.lng,
          address: displayText, // Use displayText so it matches what's in the input
          fullAddress: fullAddress, // Include fullAddress as separate field for backend if needed
        });
      } else {
        // Fallback to geocoding if place details fail
        const geocodeResults = await goongService.geocode(displayText);
        if (geocodeResults && geocodeResults.results && geocodeResults.results.length > 0) {
          const location = geocodeResults.results[0].geometry.location;
          onLocationSelect({
            latitude: location.lat,
            longitude: location.lng,
            address: displayText,
          });
        }
      }
      
      // Ensure text stays set after async operations
      setTimeout(() => {
        onChangeText(displayText);
      }, 50);
      
      setSuggestions([]);
      selectingRef.current = false;
    } catch (error) {
      console.error('Get place details error:', error);
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
      activeOpacity={0.7}
      onPress={() => {
        console.log('TouchableOpacity pressed for:', item.description || item.structured_formatting?.main_text);
        handleSuggestionPress(item);
      }}
      onPressIn={() => {
        console.log('TouchableOpacity onPressIn');
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
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    maxHeight: 200,
    zIndex: 9999,
    marginTop: 5,
    overflow: 'hidden',
  },
  suggestionItemPressed: {
    backgroundColor: '#f0f0f0',
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
  // New styles for suggested items
  suggestedItem: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  suggestedText: {
    color: '#E65100',
    fontWeight: '600',
  },
  suggestedBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  suggestedBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  // POI badge styles
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
  // Current location badge styles
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
  // Styles for invalid items
  invalidItem: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  invalidText: {
    color: '#C62828',
  },
  invalidSecondary: {
    color: '#E57373',
  },
  invalidBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  invalidBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});

export default AddressInput;
