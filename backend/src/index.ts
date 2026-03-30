import Fastify from "fastify";
import { z } from "zod";
import {
  type LocationSearchResponse,
  type VenueSearchResponse
} from "../../shared/contracts.js";
import { getConfig } from "./config.js";
import { GooglePlacesClient } from "./google.js";
import { VenueSearchService } from "./venue-search.js";

const BUDGET_TIERS = ["Free", "$", "$$", "$$$"] as const;
const ENVIRONMENT_PREFERENCES = ["indoor", "outdoor"] as const;
const SEARCH_ANCHOR_SOURCES = ["device", "manual"] as const;
const TIME_COMMITMENTS = ["quick", "standard", "linger"] as const;
const VIBE_OPTIONS = ["Cozy", "Playful", "Artsy", "Adventurous"] as const;

const config = getConfig();
const app = Fastify({
  logger: true
});

const google = new GooglePlacesClient(config);
const venueSearchService = new VenueSearchService(google);

const locationSearchSchema = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(8).optional()
});

const venueSearchSchema = z.object({
  anchor: z.object({
    latitude: z.number(),
    longitude: z.number(),
    label: z.string().optional(),
    source: z.enum(SEARCH_ANCHOR_SOURCES)
  }),
  radiusMiles: z.number().min(1).max(15),
  whenIso: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "whenIso must be a valid ISO datetime"),
  budgetCap: z.enum(BUDGET_TIERS),
  environment: z.enum(ENVIRONMENT_PREFERENCES),
  vibe: z.enum(VIBE_OPTIONS),
  timeCommitment: z.enum(TIME_COMMITMENTS)
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "serendate-backend",
    googlePlacesConfigured: true
  };
});

app.post("/api/location/search", async (request, reply): Promise<LocationSearchResponse | { error: string }> => {
  const parsed = locationSearchSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400);
    return {
      error: parsed.error.issues.map((issue) => issue.message).join("; ")
    };
  }

  const query = parsed.data.query.trim();
  if (query.length < 3) {
    reply.code(400);
    return {
      error: "Search another area needs at least 3 characters."
    };
  }

  let results;

  try {
    results = await google.searchText(query, parsed.data.limit ?? 5);
  } catch (error) {
    request.log.error(error);
    reply.code(502);
    return {
      error: "Google Places search is unavailable right now."
    };
  }

  return {
    suggestions: results.map((result) => ({
      id: result.id,
      label: `${result.name} · ${result.address}`,
      latitude: result.latitude,
      longitude: result.longitude,
      primaryType: result.primaryType
    }))
  };
});

app.post("/api/venues/search", async (request, reply): Promise<VenueSearchResponse | { error: string }> => {
  const parsed = venueSearchSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400);
    return {
      error: parsed.error.issues.map((issue) => issue.message).join("; ")
    };
  }

  try {
    const response = await venueSearchService.search(parsed.data);
    return response;
  } catch (error) {
    request.log.error(error);
    reply.code(502);
    return {
      error: "Google Places venue search is unavailable right now."
    };
  }
});

async function start(): Promise<void> {
  try {
    await app.listen({
      port: config.PORT,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
