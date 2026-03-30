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
const isDevelopment = process.env.NODE_ENV === "development";
const app = Fastify({
  logger: isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname"
          }
        }
      }
    : true
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
  const startedAt = Date.now();
  const parsed = locationSearchSchema.safeParse(request.body);
  if (!parsed.success) {
    request.log.warn({
      event: "location_search_validation_failed",
      request_id: request.id,
      duration_ms: Date.now() - startedAt,
      issues: parsed.error.issues.map((issue) => issue.message)
    });
    reply.code(400);
    return {
      error: parsed.error.issues.map((issue) => issue.message).join("; ")
    };
  }

  const query = parsed.data.query.trim();
  if (query.length < 3) {
    request.log.warn({
      event: "location_search_query_too_short",
      request_id: request.id,
      duration_ms: Date.now() - startedAt,
      query_length: query.length
    });
    reply.code(400);
    return {
      error: "Search another area needs at least 3 characters."
    };
  }

  let results;

  try {
    results = await google.searchText(query, parsed.data.limit ?? 5);
  } catch (error) {
    request.log.error({
      event: "location_search_upstream_failed",
      request_id: request.id,
      duration_ms: Date.now() - startedAt,
      stage: "google_text_search",
      error
    });
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
  const startedAt = Date.now();
  const parsed = venueSearchSchema.safeParse(request.body);
  if (!parsed.success) {
    request.log.warn({
      event: "discover_search_validation_failed",
      request_id: request.id,
      duration_ms: Date.now() - startedAt,
      issues: parsed.error.issues.map((issue) => issue.message)
    });
    reply.code(400);
    return {
      error: parsed.error.issues.map((issue) => issue.message).join("; ")
    };
  }

  try {
    const result = await venueSearchService.search(parsed.data);
    const durationMs = Date.now() - startedAt;

    request.log.info({
      event: "discover_search_summary",
      request_id: request.id,
      duration_ms: durationMs,
      anchor_source: parsed.data.anchor.source,
      radius_miles: parsed.data.radiusMiles,
      budget_cap: parsed.data.budgetCap,
      environment: parsed.data.environment,
      vibe: parsed.data.vibe,
      time_commitment: parsed.data.timeCommitment,
      broad_candidates_total: result.diagnostics.broad_candidates_total,
      finalists_enriched_total: result.diagnostics.finalists_enriched_total,
      venues_returned_total: result.diagnostics.venues_returned_total,
      broad_from_cache: result.diagnostics.broad_from_cache,
      details_cache_hits: result.diagnostics.details_cache_hits,
      details_cache_misses: result.diagnostics.details_cache_misses,
      rejected_budget_total: result.diagnostics.rejected_budget_total,
      rejected_closed_total: result.diagnostics.rejected_closed_total,
      dropped_before_details_total: result.diagnostics.dropped_before_details_total,
      dropped_after_exact_ranking_total: result.diagnostics.dropped_after_exact_ranking_total
    });

    request.log.debug({
      event: "discover_search_candidates",
      request_id: request.id,
      duration_ms: durationMs,
      candidates: result.diagnostics.candidates
    });

    if (
      result.diagnostics.broad_candidates_total > 0 &&
      result.diagnostics.venues_returned_total === 0
    ) {
      request.log.warn({
        event: "discover_search_zero_results",
        request_id: request.id,
        duration_ms: durationMs,
        anchor_source: parsed.data.anchor.source,
        radius_miles: parsed.data.radiusMiles,
        budget_cap: parsed.data.budgetCap,
        environment: parsed.data.environment,
        vibe: parsed.data.vibe,
        time_commitment: parsed.data.timeCommitment,
        broad_candidates_total: result.diagnostics.broad_candidates_total,
        finalists_enriched_total: result.diagnostics.finalists_enriched_total,
        rejected_budget_total: result.diagnostics.rejected_budget_total,
        rejected_closed_total: result.diagnostics.rejected_closed_total
      });
    }

    return {
      venues: result.venues
    };
  } catch (error) {
    request.log.error({
      event: "discover_search_failed",
      request_id: request.id,
      duration_ms: Date.now() - startedAt,
      stage: "venue_search",
      error
    });
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
