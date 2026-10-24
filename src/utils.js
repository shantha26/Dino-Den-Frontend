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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  return months > 0 ? `${years} yr ${months} mo` : `${years} yr${years > 1 ? "s" : ""}`;
}

export function toDateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export const TIMED_PACKAGES = {
  half_hour_soft_play: { minutes: 30, label: "Half Hour Soft Play" },
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
    (key) => (booking.playPackages?.[key] || 0) > 0
  );
  if (!timedKey) return false;
  const elapsed = minutesSince(booking.date, booking.timeIn, now);
  return elapsed != null && elapsed >= TIMED_PACKAGES[timedKey].minutes;
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

// Resolves dynamic package keys such as "play:package_1791977485882"
// to the current label stored in Settings.
function packageValueLabel(value, softPlayPricing = []) {
  if (PACKAGE_KEY_LABELS[value]) return PACKAGE_KEY_LABELS[value];

  if (typeof value === "string" && value.startsWith("play:")) {
    const key = value.slice("play:".length);
    const pkg = softPlayPricing.find((item) => item?.key === key);
    if (pkg?.label) return pkg.label;
  }

  return value;
}

// Build quantities from every package key saved on the booking,
// including custom packages added later in Settings.
function packageTotals(customer) {
  const playPackages =
    customer.playPackages instanceof Map
      ? Object.fromEntries(customer.playPackages)
      : customer.playPackages || {};

  const totals = {
    "arcade:coins": Number(customer.arcadeCoins) || 0,
    "arcade:basketball": Number(customer.basketballQty) || 0,
    "gaming:ps3": Number(customer.gaming?.ps3Hours) || 0,
    "gaming:ps5": Number(customer.gaming?.ps5Hours) || 0,
    "socks:kid": Number(customer.socks?.kidQty) || 0,
    "socks:adult": Number(customer.socks?.adultQty) || 0,
  };

  for (const [key, quantity] of Object.entries(playPackages)) {
    totals[`play:${key}`] = Number(quantity) || 0;
  }

  return totals;
}

// Returns one entry per kid: primary kid first, then siblings.
// Custom package labels are resolved using the current Settings list.
export function getKidPackageBreakdown(customer, softPlayPricing = []) {
  if (!customer) return [];

  const additionalKids = (customer.additionalKids || []).filter(
    (kid) => kid?.kidName
  );
  const remaining = packageTotals(customer);

  const siblingEntries = additionalKids.map((kid) => {
    const label =
      kid.packageLabel ||
      (kid.package
        ? packageValueLabel(kid.package, softPlayPricing)
        : "");

    if (
      kid.package &&
      Object.prototype.hasOwnProperty.call(remaining, kid.package) &&
      remaining[kid.package] > 0
    ) {
      remaining[kid.package] -= 1;
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
      return quantity > 1 ? `${label} ×${quantity}` : label;
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
