
 // Local-time helpers. Using toISOString() for "today" is a common bug — it
// reports the UTC date, which flips to the wrong day in the evening for
// timezones ahead of UTC (like India). These use the browser's local clock.

export function formatLocalDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatLocalTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export function formatDMY(isoDateStr) {
  if (!isoDateStr) return "";

  const [yyyy, mm, dd] = isoDateStr.split("-");

  if (!yyyy || !mm || !dd) return isoDateStr;

  return `${dd}-${mm}-${yyyy}`;
}

export function calculateAge(dobStr) {
  if (!dobStr) return "";

  const dob = new Date(dobStr);

  if (Number.isNaN(dob.getTime())) return "";

  const today = new Date();

  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();

  if (today.getDate() < dob.getDate()) months -= 1;

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return "";

  if (years < 1) return `${months} mo`;

  return months > 0
    ? `${years} yr ${months} mo`
    : `${years} yr${years > 1 ? "s" : ""}`;
}

export function toDateInputValue(value) {
  if (!value) return "";

  if (typeof value === "string") return value.slice(0, 10);

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export const TIMED_PACKAGES = {
  half_hour_soft_play: {
    minutes: 30,
    label: "Half Hour Soft Play",
  },
};

export function minutesSince(dateStr, timeStr, now = new Date()) {
  if (!dateStr || !timeStr) return null;

  const start = new Date(`${dateStr}T${timeStr}:00`);

  if (Number.isNaN(start.getTime())) return null;

  return Math.max(0, Math.floor((now - start) / 60000));
}

export function formatElapsed(minutes) {
  if (minutes == null) return "—";

  if (minutes < 60) return `${minutes}m`;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function isBookingDue(booking, now = new Date()) {
  if (!booking || booking.timeOut) return false;

  const timedKey = Object.keys(TIMED_PACKAGES).find(
    (key) => Number(booking.playPackages?.[key] || 0) > 0
  );

  if (!timedKey) return false;

  const elapsed = minutesSince(booking.date, booking.timeIn, now);

  return (
    elapsed != null &&
    elapsed >= TIMED_PACKAGES[timedKey].minutes
  );
}

// Labels for fixed package types used by CustomerForm.
export const PACKAGE_KEY_LABELS = {
  "play:half_hour_soft_play": "Half Hour Soft Play",
  "play:unlimited_soft_play": "Unlimited Soft Play",
  "play:unlimited_soft_play_arcade": "Unlimited Soft Play + Arcade",
  "arcade:coins": "Arcade Coin",
  "arcade:basketball": "Basketball",
  "gaming:ps3": "PS3 (1hr)",
  "gaming:ps5": "PS5 (1hr)",
  "socks:kid": "Kid Socks",
  "socks:adult": "Adult Socks",
};

// Normalize package settings so labels work whether keys are stored
// directly or inside a package object.
function findCustomPackage(key, softPlayPricing = []) {
  if (!Array.isArray(softPlayPricing)) return undefined;

  return softPlayPricing.find(
    (item) =>
      item &&
      String(item.key) === String(key)
  );
}

// Resolves fixed and dynamic package keys into readable labels.
// Supports both "package_123" and "play:package_123".
export function packageValueLabel(value, softPlayPricing = []) {
  if (value == null || value === "") return "";

  const normalizedValue = String(value);

  // Existing fixed labels take priority.
  if (PACKAGE_KEY_LABELS[normalizedValue]) {
    return PACKAGE_KEY_LABELS[normalizedValue];
  }

  // Strip the "play:" prefix when present.
  const key = normalizedValue.startsWith("play:")
    ? normalizedValue.slice("play:".length)
    : normalizedValue;

  // Look up custom packages using their saved key.
  const customPackage = findCustomPackage(key, softPlayPricing);

  if (customPackage?.label) {
    return customPackage.label;
  }

  // Do not display the internal "play:" prefix to the user.
  return normalizedValue.startsWith("play:")
    ? key
    : normalizedValue;
}

// Convert a Mongoose Map, ordinary object, or missing value into an object.
function toPlainObject(value) {
  if (!value) return {};

  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  if (typeof value.toObject === "function") {
    return value.toObject();
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  return {};
}

// Build quantities from every package key saved on the booking,
// including custom packages added later in Settings.
export function packageTotals(customer) {
  if (!customer) return {};

  const playPackages = toPlainObject(customer.playPackages);
  const arcade = toPlainObject(customer.arcade);
  const gaming = toPlainObject(customer.gaming);
  const socks = toPlainObject(customer.socks);

  const totals = {
    "arcade:coins":
      Number(customer.arcadeCoins ?? arcade.coins) || 0,

    "arcade:basketball":
      Number(customer.basketballQty ?? arcade.basketballQty) || 0,

    "gaming:ps3":
      Number(gaming.ps3Hours) || 0,

    "gaming:ps5":
      Number(gaming.ps5Hours) || 0,

    "socks:kid":
      Number(socks.kidQty) || 0,

    "socks:adult":
      Number(socks.adultQty) || 0,
  };

  for (const [key, quantity] of Object.entries(playPackages)) {
    totals[`play:${key}`] = Number(quantity) || 0;
  }

  return totals;
}

// Returns one entry per kid: primary kid first, then siblings.
// Custom package labels are resolved from the current Settings list.
export function getKidPackageBreakdown(
  customer,
  softPlayPricing = []
) {
  if (!customer) return [];

  const additionalKids = Array.isArray(customer.additionalKids)
    ? customer.additionalKids.filter((kid) => kid?.kidName)
    : [];

  const remaining = packageTotals(customer);

  const siblingEntries = additionalKids.map((kid) => {
    const packageKey = kid.package || "";
    const label =
      kid.packageLabel ||
      (packageKey
        ? packageValueLabel(packageKey, softPlayPricing)
        : "");

    if (
      packageKey &&
      Object.prototype.hasOwnProperty.call(remaining, packageKey) &&
      remaining[packageKey] > 0
    ) {
      remaining[packageKey] -= 1;
    }

    return {
      name: kid.kidName,
      packages: label ? [label] : [],
    };
  });

  const primaryPackages = Object.entries(remaining)
    .filter(([, quantity]) => quantity > 0)
    .map(([value, quantity]) => {
      const label = packageValueLabel(value, softPlayPricing);

      return quantity > 1
        ? `${label} ×${quantity}`
        : label;
    });

  const entries = [];

  if (customer.kidName) {
    entries.push({
      name: customer.kidName,
      packages: primaryPackages,
    });
  }

  entries.push(...siblingEntries);

  return entries;
}
