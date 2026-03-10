import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

type TabKey = "Discover" | "Plan" | "Saved";
type BudgetTier = "$" | "$$" | "$$$";
type TimeKey = "quick" | "standard" | "linger";
type LocationFilterMode = "radius" | "neighborhood";
type ActivePicker = "none" | "date" | "time" | "datetime";

const VIBE_OPTIONS = ["Cozy", "Playful", "Artsy", "Adventurous"] as const;
type Vibe = (typeof VIBE_OPTIONS)[number];

type WeatherMode = "sun" | "rain" | "any";

interface DateIdea {
  id: string;
  title: string;
  category: "Food" | "Bar" | "Museum" | "Nature" | "Event" | "Experience";
  neighborhood: string;
  venue: string;
  indoor: boolean;
  cost: BudgetTier;
  durationMinutes: number;
  distanceMiles: number;
  vibes: Vibe[];
  weatherFit: WeatherMode;
  eventTag?: string;
  blurb: string;
}

interface TimeOption {
  label: string;
  subLabel: string;
  maxMinutes: number;
}

interface PlanStop {
  id: string;
  title: string;
  venue: string;
  timeRange: string;
  note: string;
  badge: string;
}

const PALETTE = {
  night: "#0F1B2C",
  deep: "#1D3557",
  slate: "#26456F",
  mint: "#BCE9DF",
  peach: "#F6B57F",
  coral: "#F48473",
  cream: "#F7F2E9",
  ink: "#17212B",
  mutedInk: "#435367",
  panel: "rgba(247, 242, 233, 0.92)",
  panelStrong: "rgba(247, 242, 233, 0.98)",
  panelSoft: "rgba(188, 233, 223, 0.28)"
};

const FONT = Platform.select({
  ios: {
    title: "AvenirNext-Bold",
    subtitle: "AvenirNext-DemiBold",
    body: "AvenirNext-Regular"
  },
  android: {
    title: "sans-serif-condensed",
    subtitle: "sans-serif-medium",
    body: "sans-serif"
  },
  default: {
    title: "System",
    subtitle: "System",
    body: "System"
  }
});

const TIME_OPTIONS: Record<TimeKey, TimeOption> = {
  quick: { label: "Quick", subLabel: "~90 min", maxMinutes: 100 },
  standard: { label: "Evening", subLabel: "~3.5 hrs", maxMinutes: 220 },
  linger: { label: "Linger", subLabel: "~5 hrs", maxMinutes: 320 }
};

const MAX_PLANNING_DAYS_AHEAD = 120;
const TIME_STEP_MINUTES = 5;

const BUDGET_RANK: Record<BudgetTier, number> = {
  "$": 1,
  "$$": 2,
  "$$$": 3
};

const LIMITED_EVENT = {
  title: "First Friday Art Walk",
  venue: "Mission alleys",
  neighborhood: "Mission",
  time: "6:00 PM - 10:00 PM",
  blurb: "Pop-up galleries, live jazz, and late-night food stalls.",
  dayOfWeek: 5,
  indoor: false
};

const IDEAS: DateIdea[] = [
  {
    id: "stow-lake",
    title: "Twilight Rowboats + Cocoa",
    category: "Nature",
    neighborhood: "Golden Gate Park",
    venue: "Stow Lake Boathouse",
    indoor: false,
    cost: "$$",
    durationMinutes: 110,
    distanceMiles: 2.6,
    vibes: ["Adventurous", "Cozy"],
    weatherFit: "sun",
    blurb: "Rent a rowboat before sunset, then warm up with cocoa by the pavilion."
  },
  {
    id: "vinyl-wine",
    title: "Vinyl Bar Listening Session",
    category: "Bar",
    neighborhood: "Mission",
    venue: "Arc Light Bar",
    indoor: true,
    cost: "$$",
    durationMinutes: 95,
    distanceMiles: 1.1,
    vibes: ["Cozy", "Artsy"],
    weatherFit: "any",
    blurb: "Claim a booth, pick records from the wall, and pair with natural wines."
  },
  {
    id: "night-museum",
    title: "Night Museum + Observatory",
    category: "Museum",
    neighborhood: "Downtown",
    venue: "City Science Museum",
    indoor: true,
    cost: "$$",
    durationMinutes: 145,
    distanceMiles: 2.2,
    vibes: ["Artsy", "Playful"],
    weatherFit: "any",
    eventTag: "Friday special: rooftop telescope hour",
    blurb: "Hands-on exhibits, then rooftop skyline viewing with guided stargazing."
  },
  {
    id: "ferry-tasting",
    title: "Market Tasting Trail",
    category: "Food",
    neighborhood: "Waterfront",
    venue: "Ferry Market",
    indoor: true,
    cost: "$$",
    durationMinutes: 120,
    distanceMiles: 2.8,
    vibes: ["Playful", "Adventurous"],
    weatherFit: "any",
    blurb: "Build a mini progressive dinner from local bakeries, oysters, and dessert bars."
  },
  {
    id: "poetry-night",
    title: "Open Mic + Dessert Flight",
    category: "Event",
    neighborhood: "Mission",
    venue: "Paper Lantern Cafe",
    indoor: true,
    cost: "$",
    durationMinutes: 90,
    distanceMiles: 1.4,
    vibes: ["Cozy", "Artsy"],
    weatherFit: "any",
    blurb: "Share poems (or just listen), then end with a three-mini-dessert tasting."
  },
  {
    id: "cinema-marathon",
    title: "Indie Cinema Double Feature",
    category: "Experience",
    neighborhood: "Downtown",
    venue: "Grandview Theater",
    indoor: true,
    cost: "$$",
    durationMinutes: 180,
    distanceMiles: 1.8,
    vibes: ["Cozy", "Artsy"],
    weatherFit: "any",
    blurb: "One ticket, two films, and intermission espresso in an old art-house theater."
  },
  {
    id: "rooftop-tapas",
    title: "Rooftop Tapas Circuit",
    category: "Food",
    neighborhood: "SoMa",
    venue: "Three-roof route",
    indoor: false,
    cost: "$$$",
    durationMinutes: 210,
    distanceMiles: 2.9,
    vibes: ["Playful", "Adventurous"],
    weatherFit: "sun",
    blurb: "Hop across rooftop kitchens for small plates, cocktails, and skyline photos."
  },
  {
    id: "garden-scavenger",
    title: "Botanical Scavenger Date",
    category: "Nature",
    neighborhood: "Golden Gate Park",
    venue: "Conservatory Gardens",
    indoor: false,
    cost: "$",
    durationMinutes: 105,
    distanceMiles: 2.4,
    vibes: ["Playful", "Adventurous"],
    weatherFit: "sun",
    blurb: "Solve clue cards across rare plant exhibits and end with picnic pastries."
  },
  {
    id: "speakeasy-jazz",
    title: "Speakeasy Jazz + Card Tricks",
    category: "Bar",
    neighborhood: "North Beach",
    venue: "Lantern Cellar",
    indoor: true,
    cost: "$$$",
    durationMinutes: 130,
    distanceMiles: 3.2,
    vibes: ["Cozy", "Playful"],
    weatherFit: "any",
    eventTag: "Limited seats: 8 PM close-up magic set",
    blurb: "Live trio, velvet booths, and a short magic act between sets."
  }
];

const CATEGORY_ICON: Record<DateIdea["category"], keyof typeof Ionicons.glyphMap> = {
  Food: "restaurant-outline",
  Bar: "wine-outline",
  Museum: "color-palette-outline",
  Nature: "leaf-outline",
  Event: "flash-outline",
  Experience: "ticket-outline"
};

const TABS: TabKey[] = ["Discover", "Plan", "Saved"];

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

function formatClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

function buildItinerary(
  ideas: DateIdea[],
  budget: BudgetTier,
  maxMinutes: number,
  seed: number,
  includeLocalEvent: boolean,
  startMinutes: number
): PlanStop[] {
  const fitsBudget = ideas.filter((idea) => BUDGET_RANK[idea.cost] <= BUDGET_RANK[budget]);
  const pool = fitsBudget.length > 0 ? fitsBudget : ideas;
  if (pool.length === 0) {
    return [];
  }

  const rotation = seed % pool.length;
  const rotated = pool.slice(rotation).concat(pool.slice(0, rotation));

  const plan: PlanStop[] = [];
  let clock = startMinutes;
  let remaining = maxMinutes;

  for (const idea of rotated) {
    if (plan.length >= 3 || idea.durationMinutes > remaining) {
      continue;
    }

    const start = clock;
    const end = start + idea.durationMinutes;

    plan.push({
      id: idea.id,
      title: idea.title,
      venue: `${idea.venue} · ${idea.neighborhood}`,
      timeRange: `${formatClock(start)} - ${formatClock(end)}`,
      note: `${idea.cost} · ${formatMinutes(idea.durationMinutes)} · ${idea.indoor ? "Indoor" : "Outdoor"}`,
      badge: idea.category
    });

    remaining -= idea.durationMinutes;
    clock = end + 20;

    if (remaining < 55) {
      break;
    }
  }

  if (includeLocalEvent && remaining >= 50) {
    const eventStart = clock;
    const eventEnd = eventStart + 60;

    plan.push({
      id: "local-event",
      title: LIMITED_EVENT.title,
      venue: `${LIMITED_EVENT.venue} · ${LIMITED_EVENT.neighborhood}`,
      timeRange: `${formatClock(eventStart)} - ${formatClock(eventEnd)}`,
      note: "Community pop-up · Limited-time",
      badge: "Event"
    });
  }

  return plan;
}

function animatedStyle(value: Animated.Value) {
  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0]
        })
      }
    ]
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("Discover");
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<Vibe>("Cozy");
  const [selectedBudget, setSelectedBudget] = useState<BudgetTier>("$$");
  const [selectedTime, setSelectedTime] = useState<TimeKey>("standard");
  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    const now = new Date();
    const defaultDateTime = new Date(now);
    defaultDateTime.setHours(19, 0, 0, 0);
    if (defaultDateTime.getTime() <= now.getTime()) {
      defaultDateTime.setDate(defaultDateTime.getDate() + 1);
    }
    return defaultDateTime;
  });
  const [activePicker, setActivePicker] = useState<ActivePicker>("none");
  const [preferOutdoor, setPreferOutdoor] = useState(false);
  const [locationFilterMode, setLocationFilterMode] = useState<LocationFilterMode>("radius");
  const [selectedRadiusMiles, setSelectedRadiusMiles] = useState(3.5);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("All");
  const [savedIds, setSavedIds] = useState<string[]>(["vinyl-wine", "night-museum"]);
  const [planSeed, setPlanSeed] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const tabSectionTopRef = useRef<number | null>(null);
  const currentScrollYRef = useRef(0);
  const tabSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatedValues = useRef(Array.from({ length: 16 }, () => new Animated.Value(0))).current;

  const neighborhoods = useMemo(
    () => ["All", ...Array.from(new Set(IDEAS.map((idea) => idea.neighborhood)))],
    []
  );

  const filteredIdeas = useMemo(() => {
    return IDEAS.filter((idea) => {
      const locationMatch =
        locationFilterMode === "radius"
          ? idea.distanceMiles <= selectedRadiusMiles
          : selectedNeighborhood === "All" || idea.neighborhood === selectedNeighborhood;
      const environmentMatch = preferOutdoor ? !idea.indoor : idea.indoor;
      const budgetMatch = BUDGET_RANK[idea.cost] <= BUDGET_RANK[selectedBudget];
      const vibeMatch = idea.vibes.includes(selectedVibe);
      const durationMatch = idea.durationMinutes <= TIME_OPTIONS[selectedTime].maxMinutes;

      return locationMatch && environmentMatch && budgetMatch && vibeMatch && durationMatch;
    }).sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [
    locationFilterMode,
    selectedNeighborhood,
    selectedRadiusMiles,
    preferOutdoor,
    selectedBudget,
    selectedVibe,
    selectedTime
  ]);

  const discoverIdeas = useMemo(() => filteredIdeas.slice(0, 6), [filteredIdeas]);

  const savedIdeas = useMemo(
    () => IDEAS.filter((idea) => savedIds.includes(idea.id)),
    [savedIds]
  );

  const selectedDate = useMemo(() => {
    const date = new Date(selectedDateTime);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedDateTime]);

  const selectedStartMinutes = useMemo(
    () => selectedDateTime.getHours() * 60 + selectedDateTime.getMinutes(),
    [selectedDateTime]
  );

  const maxPlanningDate = useMemo(() => {
    const maxDate = new Date();
    maxDate.setHours(23, 59, 59, 999);
    maxDate.setDate(maxDate.getDate() + MAX_PLANNING_DAYS_AHEAD);
    return maxDate;
  }, []);

  const minPlanningDate = useMemo(() => {
    const minDate = new Date();
    minDate.setSeconds(0, 0);
    return minDate;
  }, []);

  const itinerary = useMemo(
    () =>
      buildItinerary(
        filteredIdeas,
        selectedBudget,
        TIME_OPTIONS[selectedTime].maxMinutes,
        planSeed,
        selectedDate.getDay() === LIMITED_EVENT.dayOfWeek && (preferOutdoor ? !LIMITED_EVENT.indoor : LIMITED_EVENT.indoor),
        selectedStartMinutes
      ),
    [filteredIdeas, selectedBudget, selectedTime, planSeed, preferOutdoor, selectedDate, selectedStartMinutes]
  );

  const selectedDateLabel = formatDateLabel(selectedDate);

  const applyWhenPreset = (preset: "tonight" | "tomorrow" | "weekend") => {
    const now = new Date();
    const next = new Date(selectedDateTime);

    if (preset === "tonight") {
      next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      next.setHours(19, 0, 0, 0);
      if (next.getTime() <= now.getTime()) {
        const rounded = new Date(now);
        rounded.setSeconds(0, 0);
        rounded.setMinutes(Math.ceil(rounded.getMinutes() / TIME_STEP_MINUTES) * TIME_STEP_MINUTES);
        next.setTime(rounded.getTime());
      }
    } else if (preset === "tomorrow") {
      next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      next.setHours(19, 0, 0, 0);
    } else {
      const weekend = new Date(now);
      const daysUntilSaturday = (6 - weekend.getDay() + 7) % 7;
      weekend.setDate(weekend.getDate() + daysUntilSaturday);
      weekend.setHours(19, 0, 0, 0);
      if (weekend.getTime() <= now.getTime()) {
        weekend.setDate(weekend.getDate() + 1);
      }
      next.setTime(weekend.getTime());
    }

    setSelectedDateTime(next);
    setActivePicker("none");
  };

  const handleTimeChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === "android") {
      setActivePicker("none");
    }
    if (!value) {
      return;
    }
    setSelectedDateTime((current) => {
      const next = new Date(current);
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
  };

  const handleDateChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === "android") {
      setActivePicker("none");
    }
    if (!value) {
      return;
    }
    setSelectedDateTime((current) => {
      const next = new Date(current);
      next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      return next;
    });
  };

  const handleDateTimeChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === "android") {
      setActivePicker("none");
    }
    if (!value) {
      return;
    }
    setSelectedDateTime((current) => {
      const next = new Date(current);
      next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
  };

  useEffect(() => {
    let count = 1;

    if (activeTab === "Discover") {
      count = discoverIdeas.length;
    } else if (activeTab === "Plan") {
      count = itinerary.length > 0 ? itinerary.length : 1;
    } else {
      count = savedIdeas.length > 0 ? savedIdeas.length : 1;
    }

    animatedValues.forEach((value) => value.setValue(0));

    Animated.stagger(
      70,
      Array.from({ length: count }, (_, index) =>
        Animated.timing(animatedValues[index], {
          toValue: 1,
          duration: 280,
          useNativeDriver: true
        })
      )
    ).start();
  }, [activeTab, animatedValues, discoverIdeas.length, itinerary.length, savedIdeas.length]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [id, ...current]
    );
  };

  const handleTabChange = (tab: TabKey) => {
    const isAlreadyShown = pendingTab === null && tab === activeTab;
    if (isAlreadyShown) {
      return;
    }

    if (tabSwitchTimeoutRef.current !== null) {
      clearTimeout(tabSwitchTimeoutRef.current);
      tabSwitchTimeoutRef.current = null;
    }

    setPendingTab(tab);

    const targetY = tabSectionTopRef.current !== null ? Math.max(tabSectionTopRef.current - 12, 0) : 0;
    const shouldDelayContentSwap = currentScrollYRef.current > targetY + 20;

    const applyTab = () => {
      setActiveTab(tab);
      setPendingTab(null);
      tabSwitchTimeoutRef.current = null;
    };

    if (tabSectionTopRef.current !== null) {
      scrollViewRef.current?.scrollTo({
        y: targetY,
        animated: true
      });
    }

    if (shouldDelayContentSwap) {
      tabSwitchTimeoutRef.current = setTimeout(() => {
        applyTab();
      }, 280);
      return;
    }

    applyTab();
  };

  useEffect(() => {
    return () => {
      if (tabSwitchTimeoutRef.current !== null) {
        clearTimeout(tabSwitchTimeoutRef.current);
      }
    };
  }, []);

  const selectedTab = pendingTab ?? activeTab;

  const PlannerHeader = (
    <View style={styles.infoRow}>
      <LinearGradient colors={[PALETTE.mint, "#A7DCCF"]} style={styles.infoCard}>
        <View style={styles.infoHead}>
          <Ionicons name="sparkles-outline" size={18} color={PALETTE.ink} />
          <Text style={styles.infoTitle}>Local Event Spotlight</Text>
        </View>
        {selectedDate.getDay() === LIMITED_EVENT.dayOfWeek ? (
          <>
            <Text style={styles.infoValue}>{LIMITED_EVENT.title}</Text>
            <Text style={styles.infoBody}>
              {LIMITED_EVENT.time} · {LIMITED_EVENT.neighborhood}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.infoValue}>No featured event for {selectedDateLabel}</Text>
            <Text style={styles.infoBody}>This spotlight runs on Fridays. Your plan still stays local and date-aware.</Text>
          </>
        )}
      </LinearGradient>
    </View>
  );

  const Controls = (
    <View style={styles.controlsWrap}>
      <View style={styles.sectionHeaderWrap}>
        <Text style={styles.sectionTitle}>Date Controls</Text>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, !preferOutdoor && styles.switchLabelActive]}>Indoor</Text>
          <Switch
            value={preferOutdoor}
            onValueChange={setPreferOutdoor}
            trackColor={{ false: "#C4CBD4", true: "#72C8B6" }}
            thumbColor={preferOutdoor ? "#FAFCFE" : "#EEF1F5"}
          />
          <Text style={[styles.switchLabel, preferOutdoor && styles.switchLabelActive]}>Outdoor</Text>
        </View>
      </View>
      <Text style={styles.switchHelpText}>
        {preferOutdoor ? "Showing outdoor date ideas" : "Showing indoor date ideas"}
      </Text>

      <Text style={styles.controlLabel}>When</Text>
      <View style={styles.quickPresetRow}>
        {([
          { key: "tonight", label: "Tonight" },
          { key: "tomorrow", label: "Tomorrow" },
          { key: "weekend", label: "This weekend" }
        ] as const).map((preset) => (
          <Pressable
            key={preset.key}
            style={styles.segment}
            onPress={() => applyWhenPreset(preset.key)}
          >
            <Text style={styles.segmentText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
      {Platform.OS === "ios" ? (
        <>
          <View style={styles.pickerRow}>
            <Pressable
              style={[styles.pickerButton, styles.pickerButtonFull]}
              onPress={() => {
                setActivePicker((current) => (current === "datetime" ? "none" : "datetime"));
              }}
            >
              <Text style={styles.pickerButtonLabel}>Date & Time</Text>
              <Text style={styles.pickerButtonValue}>
                {selectedDateLabel} at {formatClock(selectedStartMinutes)}
              </Text>
            </Pressable>
          </View>
          {activePicker === "datetime" ? (
            <View style={styles.whenPickerWrap}>
              <DateTimePicker
                value={selectedDateTime}
                mode="datetime"
                display="spinner"
                minimumDate={minPlanningDate}
                maximumDate={maxPlanningDate}
                minuteInterval={TIME_STEP_MINUTES}
                onChange={handleDateTimeChange}
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.pickerRow}>
            <Pressable
              style={styles.pickerButton}
              onPress={() => {
                setActivePicker((current) => (current === "date" ? "none" : "date"));
              }}
            >
              <Text style={styles.pickerButtonLabel}>Date</Text>
              <Text style={styles.pickerButtonValue}>{selectedDateLabel}</Text>
            </Pressable>
            <Pressable
              style={styles.pickerButton}
              onPress={() => {
                setActivePicker((current) => (current === "time" ? "none" : "time"));
              }}
            >
              <Text style={styles.pickerButtonLabel}>Start Time</Text>
              <Text style={styles.pickerButtonValue}>{formatClock(selectedStartMinutes)}</Text>
            </Pressable>
          </View>
          {activePicker === "date" ? (
            <View style={styles.whenPickerWrap}>
              <DateTimePicker
                value={selectedDateTime}
                mode="date"
                display="default"
                minimumDate={minPlanningDate}
                maximumDate={maxPlanningDate}
                onChange={handleDateChange}
              />
            </View>
          ) : null}
          {activePicker === "time" ? (
            <View style={styles.whenPickerWrap}>
              <DateTimePicker
                value={selectedDateTime}
                mode="time"
                display="default"
                minuteInterval={TIME_STEP_MINUTES}
                onChange={handleTimeChange}
              />
            </View>
          ) : null}
        </>
      )}

      <Text style={styles.whenSummary}>
        Planning for {selectedDateLabel} at {formatClock(selectedStartMinutes)}
      </Text>

      <Text style={styles.controlLabel}>Location Filter</Text>
      <View style={styles.locationModeRow}>
        {(["radius", "neighborhood"] as LocationFilterMode[]).map((mode) => {
          const selected = mode === locationFilterMode;
          const label = mode === "radius" ? "By Radius" : "By Neighborhood";
          return (
            <Pressable
              key={mode}
              style={[styles.locationModeButton, selected && styles.locationModeButtonSelected]}
              onPress={() => setLocationFilterMode(mode)}
            >
              <Text style={[styles.locationModeButtonText, selected && styles.locationModeButtonTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {locationFilterMode === "radius" ? (
        <View style={styles.radiusPanel}>
          <View style={styles.radiusHeaderRow}>
            <Text style={styles.radiusValue}>Within {selectedRadiusMiles.toFixed(1)} mi</Text>
            <Text style={styles.radiusHint}>Distance from your area</Text>
          </View>
          <Slider
            style={styles.radiusSlider}
            minimumValue={1}
            maximumValue={8}
            step={0.5}
            value={selectedRadiusMiles}
            onValueChange={(value) => setSelectedRadiusMiles(Number(value.toFixed(1)))}
            minimumTrackTintColor={PALETTE.coral}
            maximumTrackTintColor="rgba(247, 242, 233, 0.32)"
            thumbTintColor={PALETTE.peach}
          />
          <View style={styles.radiusScaleRow}>
            <Text style={styles.radiusScaleText}>1 mi</Text>
            <Text style={styles.radiusScaleText}>4.5 mi</Text>
            <Text style={styles.radiusScaleText}>8 mi</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.controlLabel}>Neighborhood</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {neighborhoods.map((option) => {
              const selected = option === selectedNeighborhood;
              return (
                <Pressable
                  key={option}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setSelectedNeighborhood(option)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={styles.controlLabel}>Vibe</Text>
      <View style={styles.inlineRow}>
        {VIBE_OPTIONS.map((vibe) => {
          const selected = vibe === selectedVibe;
          return (
            <Pressable
              key={vibe}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setSelectedVibe(vibe)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{vibe}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.controlLabel}>Budget</Text>
      <View style={styles.inlineRow}>
        {(["$", "$$", "$$$"] as BudgetTier[]).map((tier) => {
          const selected = tier === selectedBudget;
          return (
            <Pressable
              key={tier}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setSelectedBudget(tier)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{tier}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.controlLabel}>Time Commitment</Text>
      <View style={styles.inlineRow}>
        {(Object.keys(TIME_OPTIONS) as TimeKey[]).map((key) => {
          const selected = key === selectedTime;
          return (
            <Pressable
              key={key}
              style={[styles.timeCard, selected && styles.timeCardSelected]}
              onPress={() => setSelectedTime(key)}
            >
              <Text style={[styles.timeLabel, selected && styles.timeLabelSelected]}>
                {TIME_OPTIONS[key].label}
              </Text>
              <Text style={[styles.timeSubLabel, selected && styles.timeSubLabelSelected]}>
                {TIME_OPTIONS[key].subLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const DiscoverTab = (
    <View style={styles.tabBody}>
      <Text style={styles.tabIntro}>
        Ideas for {selectedDateLabel} around {formatClock(selectedStartMinutes)}, tuned to your budget and area.
      </Text>
      {discoverIdeas.length === 0 ? (
        <Animated.View style={[styles.emptyState, animatedStyle(animatedValues[0])]}>
          <Ionicons name="search-outline" size={26} color={PALETTE.deep} />
          <Text style={styles.emptyTitle}>No exact matches for this plan</Text>
          <Text style={styles.emptyBody}>Try widening area or adjusting date, time, budget, and vibe.</Text>
        </Animated.View>
      ) : (
        discoverIdeas.map((idea, index) => {
          const isSaved = savedIds.includes(idea.id);
          return (
            <Animated.View key={idea.id} style={[styles.cardWrap, animatedStyle(animatedValues[index])]}>
              <LinearGradient colors={[PALETTE.panelStrong, PALETTE.panel]} style={styles.ideaCard}>
                <View style={styles.ideaTopRow}>
                  <View style={styles.ideaBadge}>
                    <Ionicons name={CATEGORY_ICON[idea.category]} size={14} color={PALETTE.deep} />
                    <Text style={styles.ideaBadgeText}>{idea.category}</Text>
                  </View>
                  <Pressable style={styles.saveButton} onPress={() => toggleSaved(idea.id)}>
                    <Ionicons
                      name={isSaved ? "heart" : "heart-outline"}
                      size={19}
                      color={isSaved ? PALETTE.coral : PALETTE.deep}
                    />
                  </Pressable>
                </View>

                <Text style={styles.ideaTitle}>{idea.title}</Text>
                <Text style={styles.ideaVenue}>{idea.venue + " · " + idea.neighborhood}</Text>
                <Text style={styles.ideaBlurb}>{idea.blurb}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{idea.cost}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{formatMinutes(idea.durationMinutes)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{idea.indoor ? "Indoor" : "Outdoor"}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{idea.distanceMiles.toFixed(1)} mi</Text>
                </View>

                {idea.eventTag ? (
                  <View style={styles.eventTag}>
                    <Ionicons name="time-outline" size={13} color={PALETTE.ink} />
                    <Text style={styles.eventTagText}>{idea.eventTag}</Text>
                  </View>
                ) : null}
              </LinearGradient>
            </Animated.View>
          );
        })
      )}
    </View>
  );

  const PlanTab = (
    <View style={styles.tabBody}>
      <Text style={styles.tabIntro}>
        Built itinerary for {selectedDateLabel} at {formatClock(selectedStartMinutes)} with{" "}
        {TIME_OPTIONS[selectedTime].label.toLowerCase()} pace and {selectedBudget} budget.
      </Text>
      <Pressable style={styles.shuffleButton} onPress={() => setPlanSeed((current) => current + 1)}>
        <Ionicons name="shuffle-outline" size={16} color={PALETTE.cream} />
        <Text style={styles.shuffleText}>Shuffle Plan</Text>
      </Pressable>

      {itinerary.length === 0 ? (
        <Animated.View style={[styles.emptyState, animatedStyle(animatedValues[0])]}>
          <Ionicons name="calendar-outline" size={26} color={PALETTE.deep} />
          <Text style={styles.emptyTitle}>Plan could not be assembled</Text>
          <Text style={styles.emptyBody}>Try a longer time window or less strict filters.</Text>
        </Animated.View>
      ) : (
        itinerary.map((stop, index) => (
          <Animated.View key={stop.id} style={[styles.cardWrap, animatedStyle(animatedValues[index])]}>
            <LinearGradient colors={[PALETTE.panelStrong, PALETTE.panel]} style={styles.planCard}>
              <View style={styles.planHeadRow}>
                <Text style={styles.planBadge}>{stop.badge}</Text>
                <Text style={styles.planTime}>{stop.timeRange}</Text>
              </View>
              <Text style={styles.planTitle}>{stop.title}</Text>
              <Text style={styles.planVenue}>{stop.venue}</Text>
              <Text style={styles.planNote}>{stop.note}</Text>
            </LinearGradient>
          </Animated.View>
        ))
      )}
    </View>
  );

  const SavedTab = (
    <View style={styles.tabBody}>
      <Text style={styles.tabIntro}>Your bookmarked ideas for quick planning later.</Text>

      {savedIdeas.length === 0 ? (
        <Animated.View style={[styles.emptyState, animatedStyle(animatedValues[0])]}>
          <Ionicons name="heart-dislike-outline" size={26} color={PALETTE.deep} />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>Tap hearts in Discover to build your shortlist.</Text>
        </Animated.View>
      ) : (
        savedIdeas.map((idea, index) => (
          <Animated.View key={idea.id} style={[styles.cardWrap, animatedStyle(animatedValues[index])]}>
            <LinearGradient colors={[PALETTE.panelStrong, PALETTE.panel]} style={styles.ideaCard}>
              <View style={styles.ideaTopRow}>
                <View style={styles.ideaBadge}>
                  <Ionicons name={CATEGORY_ICON[idea.category]} size={14} color={PALETTE.deep} />
                  <Text style={styles.ideaBadgeText}>{idea.category}</Text>
                </View>
                <Pressable style={styles.saveButton} onPress={() => toggleSaved(idea.id)}>
                  <Ionicons name="heart" size={19} color={PALETTE.coral} />
                </Pressable>
              </View>

              <Text style={styles.ideaTitle}>{idea.title}</Text>
              <Text style={styles.ideaVenue}>{idea.venue + " · " + idea.neighborhood}</Text>
              <Text style={styles.ideaBlurb}>{idea.blurb}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{idea.cost}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{formatMinutes(idea.durationMinutes)}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{idea.indoor ? "Indoor" : "Outdoor"}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        ))
      )}
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <LinearGradient colors={[PALETTE.night, PALETTE.deep, PALETTE.slate]} style={styles.gradientBg}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={(event) => {
              currentScrollYRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.container}>
              <View style={styles.heroRow}>
                <View>
                  <Text style={styles.brand}>Serendate</Text>
                  <Text style={styles.tagline}>Date planning with local spark.</Text>
                </View>
                <View style={styles.cityPill}>
                  <Ionicons name="navigate-outline" size={13} color={PALETTE.cream} />
                  <Text style={styles.cityPillText}>SF Area</Text>
                </View>
              </View>

              {PlannerHeader}

              {Controls}
              <View
                onLayout={(event) => {
                  tabSectionTopRef.current = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.tabRow}>
                  {TABS.map((tab) => {
                    const selected = tab === selectedTab;
                    return (
                      <Pressable
                        key={tab}
                        style={[styles.tabButton, selected && styles.tabButtonSelected]}
                        onPress={() => handleTabChange(tab)}
                      >
                        <Text style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}>
                          {tab}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {activeTab === "Discover" ? DiscoverTab : null}
                {activeTab === "Plan" ? PlanTab : null}
                {activeTab === "Saved" ? SavedTab : null}
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.night
  },
  gradientBg: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 32
  },
  container: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 10
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14
  },
  brand: {
    fontSize: 36,
    color: PALETTE.cream,
    letterSpacing: 0.3,
    fontFamily: FONT?.title
  },
  tagline: {
    fontSize: 14,
    color: "rgba(247, 242, 233, 0.83)",
    marginTop: 2,
    fontFamily: FONT?.body
  },
  cityPill: {
    borderRadius: 999,
    backgroundColor: "rgba(247, 242, 233, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.2)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  cityPillText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  infoCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.14)",
    minHeight: 110
  },
  infoHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "stretch"
  },
  infoTitle: {
    fontSize: 12,
    color: PALETTE.ink,
    fontFamily: FONT?.subtitle,
    flex: 1,
    flexWrap: "wrap",
    flexShrink: 1
  },
  infoValue: {
    marginTop: 9,
    fontSize: 16,
    color: PALETTE.ink,
    fontFamily: FONT?.title
  },
  infoBody: {
    marginTop: 5,
    color: "rgba(23, 33, 43, 0.82)",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT?.body
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  tabButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.18)",
    backgroundColor: "rgba(247, 242, 233, 0.09)"
  },
  tabButtonSelected: {
    backgroundColor: PALETTE.cream,
    borderColor: PALETTE.cream
  },
  tabButtonText: {
    color: PALETTE.cream,
    fontSize: 13,
    fontFamily: FONT?.subtitle
  },
  tabButtonTextSelected: {
    color: PALETTE.deep
  },
  controlsWrap: {
    borderRadius: 20,
    backgroundColor: PALETTE.panelSoft,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.24)",
    padding: 14,
    marginBottom: 14
  },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 16,
    color: PALETTE.cream,
    fontFamily: FONT?.subtitle
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  switchLabel: {
    color: "rgba(247, 242, 233, 0.86)",
    fontSize: 12,
    fontFamily: FONT?.body
  },
  switchLabelActive: {
    color: PALETTE.cream,
    fontFamily: FONT?.subtitle
  },
  switchHelpText: {
    color: "rgba(247, 242, 233, 0.7)",
    fontSize: 11,
    marginBottom: 2,
    fontFamily: FONT?.body
  },
  controlLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "rgba(247, 242, 233, 0.7)",
    marginTop: 8,
    marginBottom: 6,
    fontFamily: FONT?.subtitle
  },
  locationModeRow: {
    flexDirection: "row",
    gap: 8
  },
  locationModeButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.25)",
    backgroundColor: "rgba(247, 242, 233, 0.08)",
    paddingVertical: 8,
    alignItems: "center"
  },
  locationModeButtonSelected: {
    backgroundColor: PALETTE.mint,
    borderColor: PALETTE.mint
  },
  locationModeButtonText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  locationModeButtonTextSelected: {
    color: PALETTE.ink
  },
  radiusPanel: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.22)",
    backgroundColor: "rgba(247, 242, 233, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  radiusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  radiusValue: {
    color: PALETTE.cream,
    fontSize: 13,
    fontFamily: FONT?.subtitle
  },
  radiusHint: {
    color: "rgba(247, 242, 233, 0.7)",
    fontSize: 11,
    fontFamily: FONT?.body
  },
  radiusSlider: {
    width: "100%",
    height: 32,
    marginTop: 2
  },
  radiusScaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2
  },
  radiusScaleText: {
    color: "rgba(247, 242, 233, 0.72)",
    fontSize: 11,
    fontFamily: FONT?.body
  },
  chipRow: {
    gap: 8,
    paddingRight: 8
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.25)",
    backgroundColor: "rgba(247, 242, 233, 0.08)"
  },
  chipSelected: {
    backgroundColor: PALETTE.mint,
    borderColor: PALETTE.mint
  },
  chipText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  chipTextSelected: {
    color: PALETTE.ink
  },
  inlineRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  segment: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 72,
    alignItems: "center",
    backgroundColor: "rgba(247, 242, 233, 0.08)"
  },
  segmentSelected: {
    backgroundColor: PALETTE.coral,
    borderColor: PALETTE.coral
  },
  segmentText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  segmentTextSelected: {
    color: "#231E1A"
  },
  timeCard: {
    flex: 1,
    minWidth: 98,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.25)",
    backgroundColor: "rgba(247, 242, 233, 0.08)"
  },
  timeCardSelected: {
    backgroundColor: PALETTE.peach,
    borderColor: PALETTE.peach
  },
  timeLabel: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  timeLabelSelected: {
    color: PALETTE.ink
  },
  timeSubLabel: {
    color: "rgba(247, 242, 233, 0.74)",
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONT?.body
  },
  timeSubLabelSelected: {
    color: "rgba(23, 33, 43, 0.75)"
  },
  quickPresetRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8
  },
  pickerRow: {
    flexDirection: "row",
    gap: 8
  },
  pickerButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.25)",
    backgroundColor: "rgba(247, 242, 233, 0.08)",
    paddingVertical: 9,
    paddingHorizontal: 10
  },
  pickerButtonFull: {
    flex: 0,
    width: "100%"
  },
  pickerButtonLabel: {
    color: "rgba(247, 242, 233, 0.72)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: FONT?.subtitle
  },
  pickerButtonValue: {
    color: PALETTE.cream,
    fontSize: 14,
    marginTop: 3,
    fontFamily: FONT?.subtitle
  },
  whenPickerWrap: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(247, 242, 233, 0.22)",
    backgroundColor: "rgba(247, 242, 233, 0.08)",
    overflow: "hidden",
    minHeight: Platform.OS === "ios" ? 216 : 56,
    justifyContent: "center"
  },
  whenSummary: {
    color: "rgba(247, 242, 233, 0.72)",
    fontSize: 11,
    marginTop: 6,
    marginBottom: 2,
    fontFamily: FONT?.body
  },
  tabBody: {
    marginTop: 2
  },
  tabIntro: {
    color: "rgba(247, 242, 233, 0.86)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    fontFamily: FONT?.body
  },
  cardWrap: {
    marginBottom: 10
  },
  ideaCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(29, 53, 87, 0.12)"
  },
  ideaTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  ideaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(29, 53, 87, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  ideaBadgeText: {
    color: PALETTE.deep,
    fontSize: 11,
    fontFamily: FONT?.subtitle
  },
  saveButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(29, 53, 87, 0.18)"
  },
  ideaTitle: {
    fontSize: 19,
    color: PALETTE.ink,
    fontFamily: FONT?.title,
    marginBottom: 4
  },
  ideaVenue: {
    color: PALETTE.deep,
    fontSize: 12,
    fontFamily: FONT?.subtitle,
    marginBottom: 7
  },
  ideaBlurb: {
    color: PALETTE.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT?.body
  },
  metaRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap"
  },
  metaText: {
    color: PALETTE.deep,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  metaDot: {
    marginHorizontal: 7,
    color: "rgba(38, 69, 111, 0.45)",
    fontSize: 12
  },
  eventTag: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(246, 181, 127, 0.35)"
  },
  eventTagText: {
    color: PALETTE.ink,
    fontSize: 11,
    fontFamily: FONT?.subtitle
  },
  shuffleButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: PALETTE.coral,
    marginBottom: 10
  },
  shuffleText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  planCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(29, 53, 87, 0.12)"
  },
  planHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  planBadge: {
    color: PALETTE.deep,
    fontSize: 11,
    fontFamily: FONT?.subtitle,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden"
  },
  planTime: {
    color: PALETTE.deep,
    fontSize: 12,
    fontFamily: FONT?.subtitle
  },
  planTitle: {
    color: PALETTE.ink,
    fontSize: 19,
    marginBottom: 4,
    fontFamily: FONT?.title
  },
  planVenue: {
    color: PALETTE.deep,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: FONT?.subtitle
  },
  planNote: {
    color: PALETTE.mutedInk,
    fontSize: 13,
    fontFamily: FONT?.body
  },
  emptyState: {
    borderRadius: 18,
    backgroundColor: PALETTE.panelStrong,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(29, 53, 87, 0.12)"
  },
  emptyTitle: {
    marginTop: 8,
    color: PALETTE.ink,
    fontSize: 17,
    fontFamily: FONT?.subtitle
  },
  emptyBody: {
    marginTop: 4,
    color: PALETTE.mutedInk,
    fontSize: 12,
    textAlign: "center",
    fontFamily: FONT?.body
  }
});
