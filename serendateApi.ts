import { Platform } from "react-native";
import type {
  LocationSearchRequest,
  LocationSearchResponse,
  VenueSearchRequest,
  VenueSearchResponse
} from "./shared/contracts";

const FALLBACK_API_BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;

export async function searchAreas(payload: LocationSearchRequest): Promise<LocationSearchResponse> {
  return postJson<LocationSearchRequest, LocationSearchResponse>("/api/location/search", payload);
}

export async function searchVenues(payload: VenueSearchRequest): Promise<VenueSearchResponse> {
  return postJson<VenueSearchRequest, VenueSearchResponse>("/api/venues/search", payload);
}

async function postJson<TRequest, TResponse>(path: string, payload: TRequest): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error(
      `Could not reach the Serendate backend at ${API_BASE_URL}. Set EXPO_PUBLIC_API_BASE_URL when running on a physical device.`
    );
  }

  const text = await response.text();
  const data = text.length > 0 ? (JSON.parse(text) as { error?: string } & TResponse) : ({} as TResponse);
  const errorMessage = (data as { error?: string }).error;

  if (!response.ok) {
    throw new Error(errorMessage ?? `Request failed with status ${response.status}`);
  }

  return data;
}
