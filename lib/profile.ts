"use client";

import type { HoursBand, VenueTypeId } from "./rates";
import { venueType } from "./rates";

export type VenueProfile = {
  type: VenueTypeId;
  m2: number;
  hours: HoursBand;
  locations: number;
  includeStreaming: boolean;
};

export const DEFAULT_PROFILE: VenueProfile = {
  type: "cafe",
  m2: venueType("cafe").defaultM2,
  hours: "normal",
  locations: 1,
  includeStreaming: true,
};

const KEY = "odatone.profile.v1";

/** Carries the calculator's answers into the signup flow. */
export function loadProfile(): VenueProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<VenueProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      m2: Number(parsed.m2) || DEFAULT_PROFILE.m2,
      locations: Math.max(1, Number(parsed.locations) || 1),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: VenueProfile): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* private mode — the flow still works, it just starts from defaults */
  }
}
