import type { SearchAnchor } from "../../shared/contracts.js";
import { MemoryCache } from "./cache.js";
import type { AppConfig } from "./config.js";

const GOOGLE_BASE_URL = "https://places.googleapis.com/v1";
const TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType";
const NEARBY_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType";
const PLACE_DETAILS_FIELD_MASK =
  "priceLevel,rating,userRatingCount,currentOpeningHours,regularOpeningHours";

// Our allowlist for venues. It's our upstream pre-filter.
export const INCLUDED_GOOGLE_TYPES = [
  "restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "wine_bar",
  "pub",
  "bakery",
  "dessert_shop",
  "museum",
  "art_gallery",
  "movie_theater",
  "performing_arts_theater",
  "park",
  "botanical_garden",
  "tourist_attraction",
  "amusement_park",
  "book_store"
] as const;

interface GoogleDisplayName {
  text?: string;
}

interface GoogleLocation {
  latitude?: number;
  longitude?: number;
}

interface GoogleSearchPlace {
  id?: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  location?: GoogleLocation;
  primaryType?: string;
}

interface GoogleSearchResponse {
  places?: GoogleSearchPlace[];
}

interface GoogleTimePoint {
  day?: number;
  hour?: number;
  minute?: number;
}

export interface GoogleOpeningPeriod {
  open?: GoogleTimePoint;
  close?: GoogleTimePoint;
}

export interface GoogleOpeningHours {
  openNow?: boolean;
  periods?: GoogleOpeningPeriod[];
}

interface GooglePlaceDetailsResponse {
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: GoogleOpeningHours;
  regularOpeningHours?: GoogleOpeningHours;
}

export interface BroadPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  primaryType?: string;
}

export interface PlaceDetails {
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: GoogleOpeningHours;
  regularOpeningHours?: GoogleOpeningHours;
}

export interface NearbySearchResult {
  places: BroadPlace[];
  fromCache: boolean;
}

export interface PlaceDetailsResult {
  details: PlaceDetails | null;
  fromCache: boolean;
}

export class GooglePlacesClient {
  private readonly broadCache = new MemoryCache<BroadPlace[]>();
  private readonly detailsCache = new MemoryCache<PlaceDetails | null>();

  constructor(private readonly config: AppConfig) {}

  static getIncludedGoogleTypes(): readonly string[] {
    return INCLUDED_GOOGLE_TYPES;
  }

  async searchText(query: string, limit: number): Promise<BroadPlace[]> {
    const payload = {
      textQuery: query,
      maxResultCount: limit
    };

    const response = await this.fetchJson<GoogleSearchResponse>("places:searchText", {
      method: "POST",
      fieldMask: TEXT_SEARCH_FIELD_MASK,
      body: payload
    });

    return (response.places ?? []).map(normalizeBroadPlace).filter(isDefined);
  }

  async searchNearby(anchor: SearchAnchor, radiusMiles: number): Promise<NearbySearchResult> {
    const cacheKey = buildBroadCacheKey(anchor, radiusMiles);
    const cached = this.broadCache.get(cacheKey);

    if (cached) {
      return {
        places: cached,
        fromCache: true
      };
    }

    const payload = {
      includedTypes: [...INCLUDED_GOOGLE_TYPES],
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: {
          center: {
            latitude: anchor.latitude,
            longitude: anchor.longitude
          },
          radius: Math.round(radiusMiles * 1609.34)
        }
      }
    };

    const response = await this.fetchJson<GoogleSearchResponse>("places:searchNearby", {
      method: "POST",
      fieldMask: NEARBY_SEARCH_FIELD_MASK,
      body: payload
    });

    const places = (response.places ?? []).map(normalizeBroadPlace).filter(isDefined);
    this.broadCache.set(cacheKey, places, this.config.BROAD_SEARCH_CACHE_TTL_MS);

    return {
      places,
      fromCache: false
    };
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
    const cached = this.detailsCache.get(placeId);

    if (cached !== undefined) {
      return {
        details: cached,
        fromCache: true
      };
    }

    const details = await this.fetchJson<GooglePlaceDetailsResponse>(`places/${encodeURIComponent(placeId)}`, {
      method: "GET",
      fieldMask: PLACE_DETAILS_FIELD_MASK
    });

    const normalized: PlaceDetails = {
      priceLevel: details.priceLevel,
      rating: details.rating,
      userRatingCount: details.userRatingCount,
      currentOpeningHours: details.currentOpeningHours,
      regularOpeningHours: details.regularOpeningHours
    };

    this.detailsCache.set(placeId, normalized, this.config.PLACE_DETAILS_CACHE_TTL_MS);

    return {
      details: normalized,
      fromCache: false
    };
  }

  private async fetchJson<TResponse>(
    path: string,
    options: {
      method: "GET" | "POST";
      fieldMask: string;
      body?: unknown;
    }
  ): Promise<TResponse> {
    const response = await fetch(`${GOOGLE_BASE_URL}/${path}`, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.config.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": options.fieldMask
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Places request failed (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as TResponse;
  }
}

function buildBroadCacheKey(anchor: SearchAnchor, radiusMiles: number): string {
  return JSON.stringify({
    latitude: Number(anchor.latitude.toFixed(4)),
    longitude: Number(anchor.longitude.toFixed(4)),
    radiusMiles: Number(radiusMiles.toFixed(1))
  });
}

function normalizeBroadPlace(place: GoogleSearchPlace): BroadPlace | null {
  const id = place.id?.trim();
  const name = place.displayName?.text?.trim();
  const address = place.formattedAddress?.trim();
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  if (!id || !name || !address || latitude === undefined || longitude === undefined) {
    return null;
  }

  return {
    id,
    name,
    address,
    latitude,
    longitude,
    primaryType: place.primaryType
  };
}

function isDefined<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}
