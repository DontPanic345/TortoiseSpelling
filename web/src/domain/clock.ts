export interface Clock {
  millis(): number;
  timeZone(): string;
}

// Read on every call so a time-zone change mid-session moves midnight.
export const deviceClock: Clock = {
  millis: () => Date.now(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};
