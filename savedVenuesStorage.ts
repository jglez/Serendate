import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VenueSummary } from "./shared/contracts";

const SAVED_VENUES_STORAGE_KEY = "serendate:saved-venues:v1";

export async function loadSavedVenues(): Promise<VenueSummary[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_VENUES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isVenueSummaryLike);
  } catch (error) {
    console.warn("Failed to load saved venues from local storage.", error);
    return [];
  }
}

export async function saveSavedVenues(venues: VenueSummary[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_VENUES_STORAGE_KEY, JSON.stringify(venues));
  } catch (error) {
    console.warn("Failed to persist saved venues to local storage.", error);
  }
}

function isVenueSummaryLike(value: unknown): value is VenueSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const venue = value as Partial<VenueSummary>;
  return (
    typeof venue.id === "string" &&
    typeof venue.provider === "string" &&
    typeof venue.name === "string" &&
    typeof venue.address === "string" &&
    typeof venue.category === "string" &&
    typeof venue.latitude === "number" &&
    typeof venue.longitude === "number" &&
    typeof venue.distanceMiles === "number" &&
    typeof venue.environment === "string" &&
    Array.isArray(venue.vibes) &&
    typeof venue.description === "string"
  );
}
