import apiService from "./api";
import { ENDPOINTS } from "../config/api";
import goongService from "./goongService";

class RouteService {
  constructor() {
    this.apiService = apiService;
  }

  /**
   * Fetch all template routes from the backend
   * @returns {Promise<Array>} Array of normalized route objects
   */
  async getTemplateRoutes() {
    try {
      const response = await this.apiService.get(ENDPOINTS.ROUTES.TEMPLATES);

      // Handle different response formats
      const routes = Array.isArray(response)
        ? response
        : response?.data || response?.content || [];

      // Normalize route data
      return routes.map((route) => this.normalizeRoute(route));
    } catch (error) {
      console.error("Get template routes error:", error);
      throw error;
    }
  }

  /**
   * Normalize route data from backend response
   * @param {Object} route - Raw route data from API
   * @returns {Object} Normalized route object
   */
  normalizeRoute(route) {
    if (!route) return null;

    // Decode polyline to get coordinates if available
    let coordinates = null;
    if (route.polyline) {
      try {
        const decoded = goongService.decodePolyline(route.polyline);
        coordinates = decoded.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        }));
      } catch (error) {
        console.warn("Failed to decode route polyline:", error);
      }
    }

    // Extract location names from route name (format: "Start to End")
    let fromLocationName = "";
    let toLocationName = "";
    if (route.name) {
      const parts = route.name.split(" to ");
      if (parts.length === 2) {
        fromLocationName = parts[0].trim();
        toLocationName = parts[1].trim();
      } else {
        // Fallback: use full name for both
        fromLocationName = route.name;
        toLocationName = route.name;
      }
    }

    // Get start and end coordinates from polyline
    let fromLocation = null;
    let toLocation = null;
    if (coordinates && coordinates.length > 0) {
      fromLocation = {
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        name: fromLocationName,
        isPOI: false,
      };
      toLocation = {
        latitude: coordinates[coordinates.length - 1].latitude,
        longitude: coordinates[coordinates.length - 1].longitude,
        name: toLocationName,
        isPOI: false,
      };
    }

    // Convert defaultPrice to number if it's a string or object
    let defaultPrice = null;
    if (route.default_price || route.defaultPrice) {
      const priceValue = route.default_price || route.defaultPrice;
      defaultPrice =
        typeof priceValue === "number"
          ? priceValue
          : parseFloat(priceValue) || null;
    }

    return {
      routeId: route.route_id || route.routeId,
      name: route.name || "",
      routeType: route.route_type || route.routeType || "TEMPLATE",
      defaultPrice: defaultPrice,
      polyline: route.polyline || null,
      coordinates: coordinates,
      fromLocation: fromLocation,
      toLocation: toLocation,
      fromLocationName: fromLocationName,
      toLocationName: toLocationName,
      validFrom: route.valid_from || route.validFrom || null,
      validUntil: route.valid_until || route.validUntil || null,
      // Keep raw data for reference
      raw: route,
    };
  }

  /**
   * Get route by ID (if needed in future)
   * Currently not implemented as backend doesn't have this endpoint
   */
  async getRouteById(routeId) {
    // This would require a backend endpoint like GET /routes/{routeId}
    // For now, we'll fetch all templates and filter
    const routes = await this.getTemplateRoutes();
    return routes.find((r) => r.routeId === routeId) || null;
  }
}

const routeService = new RouteService();
export default routeService;
