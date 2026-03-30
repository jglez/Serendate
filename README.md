# Serendate Premise

Serendate is a smart planner for fun date ideas that adapts recommendations using real-world conditions such as weather, local events, budget, time, and vibe.


Serendate is not just a cute date idea browser or for inspiration - you can use Pinterest for that. Serendate is a contexual recommendation engine. It says, "Given where you are, when you're going, what you want, and what conditions will actually be like, here are the date ideas that make sense."

## Stack

- Expo + React Native (single codebase for iOS and Android)
- TypeScript

## Run

1. Install dependencies: `npm install`
2. Start Expo: `npm run start`
3. Open in iOS simulator, Android emulator, or Expo Go.

## Scope

- Discover, Plan, and Saved tabs
- Interactive controls for time, budget, vibe, neighborhood, and weather-smart mode

## APIs
### Google Maps Places

SKUs most relevant to Serendate right now, Google’s official price list shows:

- Places API Nearby Search Pro: 5,000 free/month, then $32 per 1,000
- Places API Text Search Pro: 5,000 free/month, then $32 per 1,000
- Places API Place Details Essentials: 10,000 free/month, then $5 per 1,000
- Autocomplete Requests: 10,000 free/month, then $2.83 per 1,000

Google is the strongest MVP choice because its current free usage is actually decent for a solo prototype: Essentials SKUs get 10,000 free monthly requests and Pro SKUs get 5,000 free monthly requests. For Places specifically, Google lists Nearby Search Pro and Text Search Pro at 5,000 free/month then $32 per 1,000, Place Details Pro at 5,000 free/month then $17 per 1,000, and Weather Usage at 10,000 free/month then $0.15 per 1,000. That means we can plausibly keep venue search + place details + weather on one platform without immediately lighting money on fire.

Google also gives us a clean cost-control lever: field masks. Their docs explicitly say to request only the fields we need, and that billing is based on the highest SKU triggered by the fields we ask for. For an MVP, that matters a lot. We want the minimal data needed to make recommendations, not a bloated place payload.


# Notes

Notably, no venue provider solves “vibe,” weather, and local events by itself.

---

For April and May, Foursquare would stay free longer than Google for Serendate’s venue search, assuming your MVP can live mostly on Foursquare Pro-level place data.

Foursquare’s current pricing page says you get up to 10,000 free calls on Pro endpoints, and its Pro place schema includes the core fields we'd need for a basic candidate list, like business name, latitude/longitude, address, locality/region, website, and category labels.

Google’s practical free runway is shorter for venue discovery. A normal Serendate search results screen usually needs things like displayName and formattedAddress, and on Google those fields put Text Search and Nearby Search into Pro pricing, which currently has a 5,000 free monthly call cap per SKU. 

If we also want richer fields like opening hours or rating, those move into Enterprise, which has only a 1,000 free monthly call cap per SKU.