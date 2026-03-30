import type {
  BudgetTier,
  EnvironmentPreference,
  SearchAnchor,
  TimeCommitment,
  VenueCategory,
  VenueEnvironment,
  VenueOpenStatus,
  VenueSearchRequest,
  VenueSearchResponse,
  VenueSummary,
  Vibe
} from "../../shared/contracts.js";
import { GooglePlacesClient, type BroadPlace, type GoogleOpeningHours, type PlaceDetails } from "./google.js";

const BUDGET_RANK: Record<BudgetTier, number> = {
  Free: 0,
  "$": 1,
  "$$": 2,
  "$$$": 3
};

interface TypeProfile {
  known: boolean;
  category: VenueCategory;
  environment: VenueEnvironment;
  vibes: Vibe[];
  categoryQuality: number;
}

interface BroadCandidate {
  place: BroadPlace;
  profile: TypeProfile;
  distanceMiles: number;
  cheapScore: number;
}

interface EnrichedCandidate extends BroadCandidate {
  details: PlaceDetails | null;
  priceTier?: BudgetTier;
  rating?: number;
  ratingCount?: number;
  openStatus: VenueOpenStatus;
  exactScore: number;
}

const TYPE_PROFILES: Record<string, TypeProfile> = {
  restaurant: buildProfile("Food", "indoor", ["Cozy", "Playful"], 1),
  cafe: buildProfile("Food", "indoor", ["Cozy", "Artsy"], 0.94),
  coffee_shop: buildProfile("Food", "indoor", ["Cozy", "Artsy"], 0.94),
  bar: buildProfile("Bar", "indoor", ["Cozy", "Playful"], 0.94),
  wine_bar: buildProfile("Bar", "indoor", ["Cozy", "Artsy"], 0.95),
  pub: buildProfile("Bar", "indoor", ["Playful", "Cozy"], 0.9),
  bakery: buildProfile("Food", "indoor", ["Cozy", "Playful"], 0.82),
  dessert_shop: buildProfile("Food", "indoor", ["Cozy", "Playful"], 0.84),
  museum: buildProfile("Museum", "indoor", ["Artsy", "Cozy"], 0.96),
  art_gallery: buildProfile("Museum", "indoor", ["Artsy", "Cozy"], 0.95),
  movie_theater: buildProfile("Experience", "indoor", ["Cozy", "Artsy"], 0.9),
  performing_arts_theater: buildProfile("Experience", "indoor", ["Artsy", "Cozy"], 0.94),
  park: buildProfile("Nature", "outdoor", ["Adventurous", "Cozy"], 0.9),
  botanical_garden: buildProfile("Nature", "outdoor", ["Artsy", "Cozy"], 0.94),
  tourist_attraction: buildProfile("Experience", "mixed", ["Playful", "Adventurous"], 0.8),
  amusement_park: buildProfile("Experience", "outdoor", ["Playful", "Adventurous"], 0.88),
  book_store: buildProfile("Shopping", "indoor", ["Artsy", "Cozy"], 0.78)
};

const UNKNOWN_PROFILE: TypeProfile = {
  known: false,
  category: "Unknown",
  environment: "unknown",
  vibes: [],
  categoryQuality: 0.38
};

const QUICK_TYPES = new Set(["cafe", "coffee_shop", "bar", "bakery", "dessert_shop", "book_store"]);
const LINGER_TYPES = new Set([
  "restaurant",
  "museum",
  "art_gallery",
  "movie_theater",
  "performing_arts_theater",
  "park",
  "botanical_garden",
  "tourist_attraction",
  "amusement_park"
]);

export class VenueSearchService {
  constructor(private readonly google: GooglePlacesClient) {}

  async search(request: VenueSearchRequest): Promise<VenueSearchResponse> {
    const broadResult = await this.google.searchNearby(request.anchor, request.radiusMiles);
    const broadCandidates = broadResult.places
      .map((place) => buildBroadCandidate(place, request.anchor, request))
      .sort((left, right) => right.cheapScore - left.cheapScore);

    const finalists = broadCandidates.slice(0, 8);
    let detailsCacheHits = 0;
    let detailsCacheMisses = 0;

    const enriched = await Promise.all(
      finalists.map(async (candidate) => {
        try {
          const detailResult = await this.google.getPlaceDetails(candidate.place.id);
          if (detailResult.fromCache) {
            detailsCacheHits += 1;
          } else {
            detailsCacheMisses += 1;
          }

          return enrichCandidate(candidate, detailResult.details, request);
        } catch {
          detailsCacheMisses += 1;
          return enrichCandidate(candidate, null, request);
        }
      })
    );

    const venues = enriched
      .filter((candidate) => candidate !== null)
      .sort((left, right) => right.exactScore - left.exactScore)
      .slice(0, 6)
      .map((candidate) => toVenueSummary(candidate, request));

    return {
      venues,
      meta: {
        anchor: request.anchor,
        searchMode: "broad+enriched",
        broadCandidateCount: broadCandidates.length,
        enrichedCount: finalists.length,
        returnedCount: venues.length,
        broadFromCache: broadResult.fromCache,
        detailsCacheHits,
        detailsCacheMisses
      }
    };
  }
}

function buildProfile(
  category: VenueCategory,
  environment: VenueEnvironment,
  vibes: Vibe[],
  categoryQuality: number
): TypeProfile {
  return {
    known: true,
    category,
    environment,
    vibes,
    categoryQuality
  };
}

function buildBroadCandidate(
  place: BroadPlace,
  anchor: SearchAnchor,
  request: VenueSearchRequest
): BroadCandidate {
  const profile = getTypeProfile(place.primaryType);
  const distanceMiles = haversineMiles(anchor.latitude, anchor.longitude, place.latitude, place.longitude);

  let cheapScore = 0;
  cheapScore += Math.max(0, request.radiusMiles - distanceMiles) * 1.4;
  cheapScore += profile.categoryQuality * 8;
  cheapScore += environmentFitScore(profile.environment, request.environment);
  cheapScore += profile.vibes.includes(request.vibe) ? 4 : 0;
  cheapScore += timeCommitmentScore(place.primaryType, request.timeCommitment);
  cheapScore += profile.known ? 0 : -2.5;

  return {
    place,
    profile,
    distanceMiles,
    cheapScore
  };
}

function enrichCandidate(
  candidate: BroadCandidate,
  details: PlaceDetails | null,
  request: VenueSearchRequest
): EnrichedCandidate | null {
  const priceTier = mapPriceLevel(details?.priceLevel);
  const openStatus = evaluateOpenStatus(details, request.whenIso);

  if (priceTier && BUDGET_RANK[priceTier] > BUDGET_RANK[request.budgetCap]) {
    return null;
  }

  if (openStatus === "closed") {
    return null;
  }

  let exactScore = candidate.cheapScore;

  if (priceTier) {
    exactScore += 1.4;
  } else {
    exactScore -= 1.15;
  }

  if (openStatus === "open") {
    exactScore += 3.5;
  } else {
    exactScore -= 1.2;
  }

  if (details?.rating !== undefined) {
    exactScore += details.rating;
  }

  if (details?.userRatingCount !== undefined) {
    exactScore += Math.min(Math.log10(details.userRatingCount + 1), 3);
  }

  return {
    ...candidate,
    details,
    priceTier,
    rating: details?.rating,
    ratingCount: details?.userRatingCount,
    openStatus,
    exactScore
  };
}

function toVenueSummary(candidate: EnrichedCandidate, request: VenueSearchRequest): VenueSummary {
  return {
    id: candidate.place.id,
    provider: "google",
    name: candidate.place.name,
    address: candidate.place.address,
    primaryType: candidate.place.primaryType,
    category: candidate.profile.category,
    latitude: candidate.place.latitude,
    longitude: candidate.place.longitude,
    distanceMiles: Number(candidate.distanceMiles.toFixed(1)),
    environment: candidate.profile.environment,
    vibes: candidate.profile.vibes,
    priceTier: candidate.priceTier,
    rating: candidate.rating,
    ratingCount: candidate.ratingCount,
    openStatus: candidate.openStatus,
    summary: buildSummary(candidate, request)
  };
}

function buildSummary(candidate: EnrichedCandidate, request: VenueSearchRequest): string {
  const parts: string[] = [];

  if (candidate.profile.vibes.includes(request.vibe)) {
    parts.push(`${request.vibe.toLowerCase()} vibe`);
  }

  if (candidate.profile.environment === request.environment) {
    parts.push(`${request.environment} fit`);
  } else if (candidate.profile.environment === "mixed") {
    parts.push("mixed setting");
  } else if (candidate.profile.environment !== "unknown") {
    parts.push(`${candidate.profile.environment} setting`);
  }

  if (candidate.openStatus === "open") {
    parts.push("open at your selected time");
  }

  if (candidate.priceTier) {
    parts.push(formatBudgetPhrase(candidate.priceTier));
  }

  if (parts.length === 0) {
    return "Local option inside your current search area.";
  }

  const first = parts[0]!;
  const rest = parts.slice(1);
  return `${capitalize(first)}${rest.length > 0 ? `, ${rest.join(", ")}` : ""}.`;
}

function formatBudgetPhrase(tier: BudgetTier): string {
  switch (tier) {
    case "Free":
      return "free";
    case "$":
      return "under $50";
    case "$$":
      return "up to $120";
    case "$$$":
      return "open budget";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTypeProfile(primaryType?: string): TypeProfile {
  if (!primaryType) {
    return UNKNOWN_PROFILE;
  }

  return TYPE_PROFILES[primaryType] ?? UNKNOWN_PROFILE;
}

function environmentFitScore(
  venueEnvironment: VenueEnvironment,
  requestedEnvironment: EnvironmentPreference
): number {
  if (venueEnvironment === requestedEnvironment) {
    return 3.2;
  }

  if (venueEnvironment === "mixed") {
    return 1.4;
  }

  if (venueEnvironment === "unknown") {
    return -0.8;
  }

  return -3.4;
}

function timeCommitmentScore(primaryType: string | undefined, timeCommitment: TimeCommitment): number {
  if (!primaryType || timeCommitment === "standard") {
    return 0;
  }

  if (timeCommitment === "quick") {
    return QUICK_TYPES.has(primaryType) ? 1.6 : 0;
  }

  if (timeCommitment === "linger") {
    return LINGER_TYPES.has(primaryType) ? 1.6 : 0;
  }

  return 0;
}

function mapPriceLevel(priceLevel?: string): BudgetTier | undefined {
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return "Free";
    case "PRICE_LEVEL_INEXPENSIVE":
      return "$";
    case "PRICE_LEVEL_MODERATE":
      return "$$";
    case "PRICE_LEVEL_EXPENSIVE":
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "$$$";
    default:
      return undefined;
  }
}

function evaluateOpenStatus(details: PlaceDetails | null, whenIso: string): VenueOpenStatus {
  const when = new Date(whenIso);
  const requestTime = when.getTime();

  if (Number.isNaN(requestTime)) {
    return "unknown";
  }

  const regularHoursResult = isOpenAtRequestedTime(details?.regularOpeningHours, when);
  if (regularHoursResult !== null) {
    return regularHoursResult ? "open" : "closed";
  }

  const nowFallback = isCurrentHoursRelevant(details?.currentOpeningHours, when);
  if (nowFallback !== null) {
    return nowFallback ? "open" : "closed";
  }

  return "unknown";
}

function isCurrentHoursRelevant(hours: GoogleOpeningHours | undefined, when: Date): boolean | null {
  if (hours?.openNow === undefined) {
    return null;
  }

  const now = new Date();
  const distanceFromNow = Math.abs(when.getTime() - now.getTime());
  if (distanceFromNow > 90 * 60 * 1000) {
    return null;
  }

  return hours.openNow;
}

function isOpenAtRequestedTime(hours: GoogleOpeningHours | undefined, when: Date): boolean | null {
  const periods = hours?.periods;
  if (!periods || periods.length === 0) {
    return null;
  }

  const requestedMinute = when.getDay() * 1440 + when.getHours() * 60 + when.getMinutes();
  const requestedAlternates = [requestedMinute, requestedMinute + 7 * 1440];

  for (const period of periods) {
    const start = toWeekMinute(period.open);
    if (start === null) {
      continue;
    }

    const endBase = toWeekMinute(period.close);
    if (endBase === null) {
      return true;
    }

    const end = endBase <= start ? endBase + 7 * 1440 : endBase;

    for (const alternate of requestedAlternates) {
      if (alternate >= start && alternate < end) {
        return true;
      }
    }
  }

  return false;
}

function toWeekMinute(
  point:
    | {
        day?: number;
        hour?: number;
        minute?: number;
      }
    | undefined
): number | null {
  if (point?.day === undefined || point.hour === undefined) {
    return null;
  }

  return point.day * 1440 + point.hour * 60 + (point.minute ?? 0);
}

function haversineMiles(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(endLatitude - startLatitude);
  const longitudeDelta = toRadians(endLongitude - startLongitude);
  const startLatitudeRadians = toRadians(startLatitude);
  const endLatitudeRadians = toRadians(endLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}
