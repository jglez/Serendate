export const VIBE_OPTIONS = ["Cozy", "Playful", "Artsy", "Adventurous"] as const;
export type Vibe = (typeof VIBE_OPTIONS)[number];

export const BUDGET_TIERS = ["Free", "$", "$$", "$$$"] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

export const TIME_COMMITMENTS = ["quick", "standard", "linger"] as const;
export type TimeCommitment = (typeof TIME_COMMITMENTS)[number];

export const ENVIRONMENT_PREFERENCES = ["indoor", "outdoor"] as const;
export type EnvironmentPreference = (typeof ENVIRONMENT_PREFERENCES)[number];

export const SEARCH_ANCHOR_SOURCES = ["device", "manual"] as const;
export type SearchAnchorSource = (typeof SEARCH_ANCHOR_SOURCES)[number];

export const VENUE_CATEGORIES = [
  "Food",
  "Bar",
  "Museum",
  "Nature",
  "Experience",
  "Shopping",
  "Unknown"
] as const;
export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

export const VENUE_ENVIRONMENTS = ["indoor", "outdoor", "mixed", "unknown"] as const;
export type VenueEnvironment = (typeof VENUE_ENVIRONMENTS)[number];

export const VENUE_OPEN_STATUSES = ["open", "closed", "unknown"] as const;
export type VenueOpenStatus = (typeof VENUE_OPEN_STATUSES)[number];

export interface SearchAnchor {
  latitude: number;
  longitude: number;
  label?: string;
  source: SearchAnchorSource;
}

export interface LocationSearchRequest {
  query: string;
  limit?: number;
}

export interface LocationSuggestion {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  primaryType?: string;
}

export interface LocationSearchResponse {
  suggestions: LocationSuggestion[];
}

export interface VenueSummary {
  id: string;
  provider: "google";
  name: string;
  address: string;
  primaryType?: string;
  category: VenueCategory;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  environment: VenueEnvironment;
  vibes: Vibe[];
  priceTier?: BudgetTier;
  rating?: number;
  ratingCount?: number;
  openStatus?: VenueOpenStatus;
  summary: string;
}

export interface VenueSearchRequest {
  anchor: SearchAnchor;
  radiusMiles: number;
  whenIso: string;
  budgetCap: BudgetTier;
  environment: EnvironmentPreference;
  vibe: Vibe;
  timeCommitment: TimeCommitment;
}

export interface VenueSearchMeta {
  anchor: SearchAnchor;
  searchMode: "broad+enriched";
  broadCandidateCount: number;
  enrichedCount: number;
  returnedCount: number;
  broadFromCache: boolean;
  detailsCacheHits: number;
  detailsCacheMisses: number;
}

export interface VenueSearchResponse {
  venues: VenueSummary[];
  meta: VenueSearchMeta;
}
