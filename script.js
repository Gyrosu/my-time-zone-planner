const $ = id => document.getElementById(id);

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
];

const REGION_ALIASES = {
  ca: "California",
  calif: "California",
  id: "Idaho",
  ny: "New York",
  tx: "Texas",
  wa: "Washington",
  fl: "Florida",
  co: "Colorado",
  on: "Ontario",
  bc: "British Columbia",
};

const PLACE_SUGGESTIONS = {
  china: [
    place("Beijing, China", "Asia/Shanghai"),
    place("Shanghai, China", "Asia/Shanghai"),
    place("Guangzhou, Guangdong, China", "Asia/Shanghai"),
    place("Shenzhen, Guangdong, China", "Asia/Shanghai"),
    place("Chengdu, Sichuan, China", "Asia/Shanghai"),
    place("Hong Kong, China", "Asia/Hong_Kong"),
  ],
  california: [
    place("California, United States", "America/Los_Angeles"),
    place("Los Angeles, California, United States", "America/Los_Angeles"),
    place("San Francisco, California, United States", "America/Los_Angeles"),
    place("San Diego, California, United States", "America/Los_Angeles"),
    place("Sacramento, California, United States", "America/Los_Angeles"),
    place("Mountain View, California, United States", "America/Los_Angeles"),
  ],
  idaho: [
    place("Idaho, United States", "America/Denver"),
    place("Boise, Idaho, United States", "America/Denver"),
    place("Idaho Falls, Idaho, United States", "America/Denver"),
    place("Twin Falls, Idaho, United States", "America/Denver"),
    place("Coeur d'Alene, Idaho, United States", "America/Los_Angeles"),
  ],
  "mountain view": [
    place("Mountain View, California, United States", "America/Los_Angeles"),
    place("Mountain View, Arkansas, United States", "America/Chicago"),
    place("Mountain View, Hawaii, United States", "Pacific/Honolulu"),
    place("Mountain View, Missouri, United States", "America/Chicago"),
  ],
  "mountain view ca": [place("Mountain View, California, United States", "America/Los_Angeles")],
  "boise idaho": [place("Boise, Idaho, United States", "America/Denver")],
  "boise id": [place("Boise, Idaho, United States", "America/Denver")],
  london: [place("London, United Kingdom", "Europe/London"), place("London, Ontario, Canada", "America/Toronto")],
  "london uk": [place("London, United Kingdom", "Europe/London")],
  shanghai: [place("Shanghai, China", "Asia/Shanghai")],
  "shanghai china": [place("Shanghai, China", "Asia/Shanghai")],
  japan: [
    place("Tokyo, Japan", "Asia/Tokyo"),
    place("Osaka, Japan", "Asia/Tokyo"),
    place("Sapporo, Hokkaido, Japan", "Asia/Tokyo"),
  ],
  "united states": [
    place("New York, New York, United States", "America/New_York"),
    place("Los Angeles, California, United States", "America/Los_Angeles"),
    place("Chicago, Illinois, United States", "America/Chicago"),
    place("Denver, Colorado, United States", "America/Denver"),
    place("Honolulu, Hawaii, United States", "Pacific/Honolulu"),
  ],
};

const PROFILE_OPTIONS = [
  { id: "rabbit", label: "Rabbit", kind: "rabbit", color: "#ffdce8" },
  { id: "hamster", label: "Hamster", kind: "hamster", color: "#fff3b8" },
  { id: "cat", label: "Cat", kind: "cat", color: "#e7dcff" },
  { id: "dog", label: "Dog", kind: "dog", color: "#d8ecff" },
  { id: "turtle", label: "Turtle", kind: "turtle", color: "#dff5d8" },
  { id: "goldfish", label: "Goldfish", kind: "goldfish", color: "#ffe1b8" },
  { id: "baseball", label: "Baseball", kind: "baseball", color: "#fffdf2" },
  { id: "basketball", label: "Basketball", kind: "basketball", color: "#ffbf75" },
  { id: "tennis", label: "Tennis", kind: "tennis", color: "#dff56a" },
  { id: "badminton", label: "Badminton", kind: "badminton", color: "#d8ecff" },
  { id: "football", label: "Football", kind: "football", color: "#a8754d" },
  { id: "soccer", label: "Soccer", kind: "soccer", color: "#fffdf2" },
];

let contacts = JSON.parse(localStorage.getItem("timezoneContacts") || "[]");
let pendingPlaceChoice = null;
let pendingPlaceOptions = [];
let clickAudioContext;

function place(label, timezone) {
  return { label, timezone, country: countryFromLabel(label), region: regionFromLabel(label) };
}

function init() {
  populateTimezones();
  $("date").value = new Date().toISOString().slice(0, 10);
  setTimezoneValue("sourceTz", guessLocalTimezone(), "UTC");
  setTimezoneValue("targetTz", "America/New_York", "UTC");
  $("safetyBackendUrl").value = localStorage.getItem("safetyBackendUrl") || defaultSafetyBackendUrl();
  $("safetyBackendUrl").addEventListener("change", () => {
    localStorage.setItem("safetyBackendUrl", $("safetyBackendUrl").value.trim());
  });

  document.querySelectorAll("[data-place-kind]").forEach(button => {
    button.addEventListener("click", () => findPlace(button.dataset.placeKind));
  });
  document.querySelectorAll("[data-toggle-zone]").forEach(button => {
    button.addEventListener("click", () => button.classList.toggle("show-zone"));
  });
  [
    ["sourcePlace", "source"],
    ["targetPlace", "target"],
    ["contactArea", "contact"],
  ].forEach(([inputId, kind]) => {
    $(inputId).addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      findPlace(kind);
    });
  });

  $("convertButton").addEventListener("click", convertTimes);
  $("swapButton").addEventListener("click", swapZones);
  $("saveContactButton").addEventListener("click", saveContact);
  $("closeChooser").addEventListener("click", () => closePlaceChooser());
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("placeChooser").classList.contains("show")) closePlaceChooser();
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    playButtonClick();
    bounceButton(button);
  });
  document.addEventListener("animationend", event => {
    if (event.animationName === "button-bounce") event.target.classList.remove("button-bounce");
  });

  renderContacts();
}

function populateTimezones() {
  const zones = supportedTimezones();
  ["sourceTz", "targetTz"].forEach(id => {
    $(id).innerHTML = zones.map(zone => `<option value="${zone}">${zone}</option>`).join("");
  });
}

function supportedTimezones() {
  const validCommon = COMMON_TIMEZONES.filter(isValidTimeZone);
  if (Intl.supportedValuesOf) {
    return Array.from(new Set([...validCommon, ...Intl.supportedValuesOf("timeZone")])).sort();
  }
  return validCommon.sort();
}

function defaultSafetyBackendUrl() {
  if (location.protocol.startsWith("http") && location.hostname.endsWith("vercel.app")) {
    return `${location.origin}/api/check-on-them`;
  }
  return "";
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function setTimezoneValue(selectId, preferred, fallback) {
  const select = $(selectId);
  const values = Array.from(select.options).map(option => option.value);
  select.value = values.includes(preferred) ? preferred : fallback;
  if (!select.value && select.options.length) select.value = select.options[0].value;
}

function guessLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function normalizePlace(value) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const words = cleaned.split(" ");
  const last = words[words.length - 1];
  if (REGION_ALIASES[last]) words[words.length - 1] = REGION_ALIASES[last].toLowerCase();
  return words.join(" ")
    .replace("mountan", "mountain")
    .replace("calif", "california")
    .trim();
}

async function findPlace(kind) {
  const map = {
    source: ["sourcePlace", "sourceTz", "sourceSelected"],
    target: ["targetPlace", "targetTz", "targetSelected"],
    contact: ["contactArea", "contactTz", "contactSelected"],
  };
  const [placeId, tzId, selectedId] = map[kind];
  const query = $(placeId).value.trim();
  if (!query) {
    show("Type a place first.");
    return null;
  }
  show(`Looking up ${query}...`);
  const places = await lookupPlaces(query);
  if (!places.length) {
    show(`No places found for ${query}. Try a city and state, like Boise Idaho.`);
    return null;
  }
  const selected = places.length === 1 ? places[0] : await choosePlace(query, places);
  if (!selected) {
    show(`Choose the matching place for ${query}.`);
    return null;
  }
  applySelectedPlace(placeId, tzId, selectedId, selected);
  show(`Selected ${selected.label}.\nClick the selected place if you want to see the hidden time zone.`);
  return selected;
}

async function lookupPlaces(query) {
  const normalized = normalizePlace(query);
  if (PLACE_SUGGESTIONS[normalized]) return PLACE_SUGGESTIONS[normalized];
  if (PLACE_SUGGESTIONS[normalized.replace(" united states", "")]) return PLACE_SUGGESTIONS[normalized.replace(" united states", "")];
  const parts = normalized.split(" ");
  if (parts.length > 1) {
    const region = parts.slice(1).join(" ");
    const cityRegionKey = `${parts[0]} ${region}`;
    if (PLACE_SUGGESTIONS[cityRegionKey]) return PLACE_SUGGESTIONS[cityRegionKey];
  }
  return fetchOpenMeteoPlaces(query);
}

async function fetchOpenMeteoPlaces(query) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({
      name: query,
      count: "8",
      language: "en",
      format: "json",
    })}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || [])
      .filter(item => item.timezone)
      .map(item => ({
        label: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
        timezone: item.timezone,
        latitude: item.latitude,
        longitude: item.longitude,
      }));
  } catch {
    return [];
  }
}

function applySelectedPlace(placeId, tzId, selectedId, selected) {
  $(placeId).value = selected.label;
  $(tzId).value = selected.timezone;
  if (placeId === "contactArea") {
    $("contactArea").dataset.country = selected.country || countryFromLabel(selected.label);
    $("contactArea").dataset.region = selected.region || regionFromLabel(selected.label);
  }
  $(selectedId).innerHTML = `${escapeHtml(selected.label)}<small>Time zone: ${escapeHtml(selected.timezone)}</small>`;
  $(selectedId).classList.remove("show-zone");
}

function choosePlace(query, places) {
  return new Promise(resolve => {
    pendingPlaceChoice = resolve;
    pendingPlaceOptions = places;
    $("placeChooserTitle").textContent = `Choose the right ${query}`;
    $("placeChoices").innerHTML = places.map((item, index) => `
      <button class="place-option" type="button" data-place-index="${index}">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.timezone || "Time zone unavailable")}</span>
      </button>
    `).join("");
    $("placeChoices").querySelectorAll("[data-place-index]").forEach(button => {
      button.addEventListener("click", () => selectPlaceChoice(Number(button.dataset.placeIndex)));
    });
    $("placeChooser").classList.add("show");
  });
}

function selectPlaceChoice(index) {
  const choice = pendingPlaceChoice;
  const placeChoice = pendingPlaceOptions[index];
  if (!choice || !placeChoice) return;
  closePlaceChooser(false);
  choice(placeChoice);
}

function closePlaceChooser(resolveChoice = true) {
  $("placeChooser").classList.remove("show");
  $("placeChoices").innerHTML = "";
  if (resolveChoice && pendingPlaceChoice) pendingPlaceChoice(null);
  pendingPlaceChoice = null;
  pendingPlaceOptions = [];
}

function convertTimes() {
  try {
    const sourceTz = $("sourceTz").value;
    const targetTz = $("targetTz").value;
    const date = parseDateInput($("date").value);
    const entries = $("times").value.split(/\n+/).map(line => line.trim()).filter(Boolean);
    if (!entries.length) throw new Error("Enter at least one free time.");
    const lines = [];
    entries.forEach(entry => {
      const parsed = parseTimeEntry(entry);
      parsed.forEach(item => {
        if (item.kind === "range") {
          const start = wallTimeToInstant(date, item.start, sourceTz);
          let end = wallTimeToInstant(date, item.end, sourceTz);
          if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          lines.push(`${entry}\n${formatInZone(start, sourceTz)} to ${formatInZone(end, sourceTz)} in ${sourceTz}\n-> ${formatInZone(start, targetTz)} to ${formatInZone(end, targetTz)} in ${targetTz}`);
        } else {
          const instant = wallTimeToInstant(date, item.time, sourceTz);
          lines.push(`${entry}\n${formatInZone(instant, sourceTz)} in ${sourceTz}\n-> ${formatInZone(instant, targetTz)} in ${targetTz}`);
        }
      });
    });
    show(lines.join("\n\n"));
  } catch (error) {
    show(error.message);
  }
}

function parseDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a date.");
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function parseTimeEntry(value) {
  const cleaned = value.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const rangeParts = cleaned.split(/\s+(?:to|until|through)\s+|\s*-\s*/).filter(Boolean);
  if (rangeParts.length >= 2) {
    const endSuffix = suffixOf(rangeParts[1]);
    return [{ kind: "range", start: parseSingleTime(rangeParts[0], endSuffix), end: parseSingleTime(rangeParts[1]) }];
  }
  const first = parseSingleTime(cleaned);
  if (!first.suffix && first.hour >= 1 && first.hour <= 12) {
    return [
      { kind: "time", time: { ...first, suffix: "AM", hour24: first.hour % 12 } },
      { kind: "time", time: { ...first, suffix: "PM", hour24: first.hour === 12 ? 12 : first.hour + 12 } },
    ];
  }
  return [{ kind: "time", time: first }];
}

function suffixOf(value) {
  const match = value.match(/\b(am|pm|a\.m\.|p\.m\.)\b/i);
  return match ? match[1].replace(/\./g, "").toLowerCase() : "";
}

function parseSingleTime(raw, impliedSuffix = "") {
  let value = raw.replace(/\./g, "").replace("noon", "12 pm").replace("midnight", "12 am").trim();
  value = value.replace(/\b(in the morning|morning)\b/g, " am");
  value = value.replace(/\b(in the afternoon|afternoon|evening|night)\b/g, " pm");
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) throw new Error(`Could not understand time: ${raw}`);
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = (match[3] || impliedSuffix || "").toLowerCase();
  if (minute > 59) throw new Error(`Minutes must be 00 through 59: ${raw}`);
  let hour24 = hour;
  if (suffix) {
    if (hour < 1 || hour > 12) throw new Error(`12-hour times must use 1 through 12: ${raw}`);
    hour24 = suffix === "pm" && hour !== 12 ? hour + 12 : hour;
    if (suffix === "am" && hour === 12) hour24 = 0;
  } else if (hour > 23) {
    throw new Error(`24-hour times must use 0 through 23: ${raw}`);
  }
  return { hour, minute, suffix: suffix.toUpperCase(), hour24 };
}

function wallTimeToInstant(date, time, timeZone) {
  let guess = Date.UTC(date.year, date.month - 1, date.day, time.hour24, time.minute);
  for (let i = 0; i < 5; i += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const desired = Date.UTC(date.year, date.month - 1, date.day, time.hour24, time.minute);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const diff = desired - actual;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
  };
}

function formatInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function swapZones() {
  const sourceTz = $("sourceTz").value;
  const sourcePlace = $("sourcePlace").value;
  const sourceSelected = $("sourceSelected").innerHTML;
  $("sourceTz").value = $("targetTz").value;
  $("sourcePlace").value = $("targetPlace").value;
  $("sourceSelected").innerHTML = $("targetSelected").innerHTML;
  $("targetTz").value = sourceTz;
  $("targetPlace").value = sourcePlace;
  $("targetSelected").innerHTML = sourceSelected;
  $("sourceSelected").classList.remove("show-zone");
  $("targetSelected").classList.remove("show-zone");
}

async function saveContact() {
  if (!$("contactTz").value.trim() && $("contactArea").value.trim()) {
    const selected = await findPlace("contact");
    if (!selected) return;
  }
  const contact = {
    name: $("contactName").value.trim(),
    area: $("contactArea").value.trim(),
    cityRegion: $("contactArea").value.trim(),
    country: $("contactArea").dataset.country || countryFromLabel($("contactArea").value),
    region: $("contactArea").dataset.region || regionFromLabel($("contactArea").value),
    timezone: $("contactTz").value.trim(),
    notes: $("contactNotes").value.trim(),
  };
  if (!contact.name || !contact.area || !contact.timezone) {
    show("Enter a name and area, then select the contact place.");
    return;
  }
  const existing = contacts.find(item => item.name.toLowerCase() === contact.name.toLowerCase());
  contact.profile = existing?.profile || randomProfileId(contact.name);
  contacts = contacts.filter(item => item.name.toLowerCase() !== contact.name.toLowerCase());
  contacts.push(contact);
  saveContacts();
  renderContacts();
  burstCelebrate($("contactSelected"));
  show(`Saved ${contact.name}.`);
}

function renderContacts() {
  $("contacts").style.setProperty("--contact-count", contacts.length);
  $("contacts").style.setProperty("--stack-height", contacts.length ? `${206 + (contacts.length - 1) * 18}px` : "0px");
  $("contacts").style.setProperty("--expanded-height", contacts.length ? `${contacts.length * 402}px` : "0px");
  $("contacts").innerHTML = contacts.map((contact, index) => `
    <div class="contact" data-contact-index="${index}" style="--i: ${index}">
      <button class="profile-toggle" type="button" data-profile-toggle="${index}" title="Show contact profile">+</button>
      <div class="contact-top">
        <img class="avatar" alt="" src="${profileAvatar(contact.profile || randomProfileId(contact.name), contact.name, index)}">
        <div>
          <strong>${escapeHtml(contact.name)}</strong>
          <span>${escapeHtml(contact.area)}</span>
        </div>
      </div>
      <div class="profile-panel">
        <div class="profile-details">
          <span>Profile: ${escapeHtml(profileLabel(contact.profile || randomProfileId(contact.name)))}</span>
          <span>Place: ${escapeHtml(contact.area)}</span>
          <span>Country: ${escapeHtml(contact.country || countryFromLabel(contact.area) || "Unknown")}</span>
          <span>Time zone: ${escapeHtml(contact.timezone)}</span>
          <span>Notes: ${escapeHtml(contact.notes || "None")}</span>
        </div>
        <div class="profile-choices">
          ${PROFILE_OPTIONS.map(option => `
            <button class="profile-choice" type="button" data-profile="${option.id}" data-profile-index="${index}" title="${escapeHtml(option.label)}">
              <img alt="${escapeHtml(option.label)}" src="${profileAvatar(option.id, option.label, index)}">
            </button>
          `).join("")}
        </div>
      </div>
      <button class="place-chip" type="button" data-contact-zone="${index}">
        Selected place
        <small>Time zone: ${escapeHtml(contact.timezone)}</small>
      </button>
      <div class="button-row">
        <button type="button" data-use-contact="${index}">Use</button>
        <button type="button" data-check-contact="${index}">Check on Them</button>
        <button type="button" data-articles-contact="${index}">Find Articles</button>
        <button type="button" data-delete-contact="${index}">Delete</button>
      </div>
    </div>
  `).join("");
  $("contacts").querySelectorAll("[data-profile-toggle]").forEach(button => button.addEventListener("click", () => toggleProfile(Number(button.dataset.profileToggle))));
  $("contacts").querySelectorAll("[data-profile]").forEach(button => button.addEventListener("click", () => setContactProfile(Number(button.dataset.profileIndex), button.dataset.profile)));
  $("contacts").querySelectorAll("[data-contact-zone]").forEach(button => button.addEventListener("click", () => button.classList.toggle("show-zone")));
  $("contacts").querySelectorAll("[data-use-contact]").forEach(button => button.addEventListener("click", () => useContact(Number(button.dataset.useContact))));
  $("contacts").querySelectorAll("[data-check-contact]").forEach(button => button.addEventListener("click", () => checkSafety(Number(button.dataset.checkContact))));
  $("contacts").querySelectorAll("[data-articles-contact]").forEach(button => button.addEventListener("click", () => findSafetyArticles(Number(button.dataset.articlesContact))));
  $("contacts").querySelectorAll("[data-delete-contact]").forEach(button => button.addEventListener("click", () => deleteContact(Number(button.dataset.deleteContact))));
}

function saveContacts() {
  localStorage.setItem("timezoneContacts", JSON.stringify(contacts));
}

function useContact(index) {
  const contact = contacts[index];
  $("targetPlace").value = contact.area;
  $("targetTz").value = contact.timezone;
  $("targetSelected").innerHTML = `${escapeHtml(contact.area)}<small>Time zone: ${escapeHtml(contact.timezone)}</small>`;
  $("targetSelected").classList.remove("show-zone");
  show(`Using ${contact.name}'s place.`);
}

async function checkSafety(index) {
  const contact = contacts[index];
  const backendUrl = $("safetyBackendUrl").value.trim();
  if (backendUrl) {
    show(`Checking trusted public sources for ${contact.area}...`);
    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, location: contact.area }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The safety backend returned an error.");
      show(formatSafetyResponse(data));
      return;
    } catch (error) {
      show(`Could not reach the safety backend.\n\n${error.message}\n\nCheck the backend URL, then try again.`);
      return;
    }
  }

  show(`Checking public weather and safety links for ${contact.area}...`);
  const weather = await weatherSummary(contact.area);
  const query = encodeURIComponent(`${contact.area} severe weather public safety traffic accident food safety alert local news`);
  show(`Safety snapshot for ${contact.area}

${weather}

Safety News:
- Optional backend not configured. Browser-only pages cannot reliably search every trusted news and alert source because many sites block cross-origin browser requests.

Traffic:
- Optional backend not configured.

Food/Health Alerts:
- Optional backend not configured.

General Local Updates:
- Search manually: https://news.google.com/search?q=${query}`);
}

function formatSafetyResponse(data) {
  const categories = data.categories || {};
  const sections = ["Weather", "Safety News", "Traffic", "Food/Health Alerts", "General Local Updates"];
  const lines = [
    `Safety snapshot for ${data.location || "contact"}`,
    data.generatedAt ? `Checked: ${new Date(data.generatedAt).toLocaleString("en-US")}` : "",
    data.note || "",
  ].filter(Boolean);

  sections.forEach(section => {
    const items = categories[section] || [];
    lines.push("", `${section}:`);
    if (!items.length) {
      lines.push("- No reliable results found.");
      return;
    }
    items.slice(0, 5).forEach(item => {
      lines.push(`- ${item.title || item.summary || "Update"}`);
      if (item.summary && item.title) lines.push(`  ${item.summary}`);
      if (item.url) lines.push(`  ${item.url}`);
    });
  });
  return lines.join("\n");
}

async function findSafetyArticles(index) {
  const contact = contacts[index];
  const endpoint = safetyArticlesBackendUrl();
  if (!endpoint) {
    const query = encodeURIComponent(`${contact.area} attack shooting assault wildfire fire flood storm emergency police warning road closure food recall health alert when:7d`);
    show(`Recent safety-related articles for ${contact.area}

- Article search backend is not configured.
- Search manually: https://news.google.com/search?q=${query}`);
    return;
  }

  show(`Searching recent safety-related articles for ${contact.area}...`);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact, location: contact.area }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Article search failed.");
    show(formatArticleResponse(data));
  } catch (error) {
    show(`Could not fetch recent articles.\n\n${error.message}\n\nTry the manual Google News link for this contact.`);
  }
}

function safetyArticlesBackendUrl() {
  const safetyUrl = $("safetyBackendUrl").value.trim() || defaultSafetyBackendUrl();
  if (!safetyUrl) return "";
  try {
    const url = new URL(safetyUrl, location.href);
    url.pathname = url.pathname.replace(/\/api\/check-on-them\/?$/, "/api/safety-articles");
    if (!url.pathname.endsWith("/api/safety-articles")) url.pathname = "/api/safety-articles";
    return url.toString();
  } catch {
    return "";
  }
}

function formatArticleResponse(data) {
  const lines = [
    `Recent safety-related articles for ${data.location || "contact"}`,
    data.generatedAt ? `Checked: ${new Date(data.generatedAt).toLocaleString("en-US")}` : "",
    data.note || "",
    "",
  ].filter(Boolean);

  const articles = data.articles || [];
  if (!articles.length) {
    lines.push("- No article links were returned for the past week.");
    if (data.searchUrl) lines.push(`- Manual search: ${data.searchUrl}`);
    return lines.join("\n");
  }

  articles.forEach((article, index) => {
    lines.push(`${index + 1}. ${article.title}`);
    if (article.source || article.published) lines.push(`   ${[article.source, article.published].filter(Boolean).join(" - ")}`);
    if (article.url) lines.push(`   ${article.url}`);
  });
  if (data.searchUrl) lines.push("", `More results: ${data.searchUrl}`);
  return lines.join("\n");
}

async function weatherSummary(area) {
  const places = await lookupPlaces(area);
  let placeInfo = places.find(item => item.latitude && item.longitude);
  if (!placeInfo) {
    const onlinePlaces = await fetchOpenMeteoPlaces(area);
    placeInfo = onlinePlaces.find(item => item.latitude && item.longitude);
  }
  if (!placeInfo) return "Weather:\n- Coordinates unavailable for this saved place.";
  try {
    const params = new URLSearchParams({
      latitude: placeInfo.latitude,
      longitude: placeInfo.longitude,
      current: "weather_code,precipitation,wind_speed_10m,wind_gusts_10m",
      forecast_days: "1",
      timezone: "auto",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const data = await response.json();
    const current = data.current || {};
    return `Weather:\n- Weather code: ${current.weather_code ?? "unknown"}\n- Wind: ${current.wind_speed_10m ?? "unknown"} km/h; gusts: ${current.wind_gusts_10m ?? "unknown"} km/h\n- Precipitation: ${current.precipitation ?? "unknown"} mm`;
  } catch {
    return "Weather:\n- Could not load public weather data.";
  }
}

function toggleProfile(index) {
  const card = document.querySelector(`[data-contact-index="${index}"]`);
  if (!card) return;
  card.classList.toggle("show-profile");
  const button = card.querySelector(".profile-toggle");
  if (button) button.textContent = card.classList.contains("show-profile") ? "-" : "+";
}

function setContactProfile(index, profile) {
  if (!contacts[index]) return;
  contacts[index].profile = profile;
  saveContacts();
  renderContacts();
  show(`${contacts[index].name}'s profile picture is now ${profileLabel(profile)}.`);
}

function deleteContact(index) {
  const card = document.querySelector(`[data-contact-index="${index}"]`);
  const contact = contacts[index];
  if (!contact) return;
  butterflyBreak(card);
  if (card) card.classList.add("deleting");
  window.setTimeout(() => {
    contacts.splice(index, 1);
    saveContacts();
    renderContacts();
    show(`Deleted ${contact.name}.`);
  }, 520);
}

function randomProfileId(name) {
  const seed = Array.from(name || "friend").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PROFILE_OPTIONS[seed % PROFILE_OPTIONS.length].id;
}

function profileLabel(profileId) {
  return (PROFILE_OPTIONS.find(option => option.id === profileId) || PROFILE_OPTIONS[0]).label;
}

function profileAvatar(profileId) {
  const option = PROFILE_OPTIONS.find(item => item.id === profileId) || PROFILE_OPTIONS[0];
  const face = `
    <circle cx="38" cy="46" r="4.5" fill="#243142"/>
    <circle cx="62" cy="46" r="4.5" fill="#243142"/>
    <path d="M39 62 Q50 72 61 62" fill="none" stroke="#243142" stroke-width="4" stroke-linecap="round"/>
    <circle cx="28" cy="58" r="5" fill="#f4a7b9" opacity=".78"/>
    <circle cx="72" cy="58" r="5" fill="#f4a7b9" opacity=".78"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="${option.color}"/>${profileBody(option.kind, face)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function profileBody(kind, face) {
  const line = 'stroke="#243142" stroke-width="3.5" stroke-linecap="round" fill="none"';
  const sportsFace = `${face}<path d="M25 76 Q50 88 75 76" ${line} opacity=".35"/>`;
  const bodies = {
    rabbit: `<ellipse cx="35" cy="24" rx="9" ry="23" fill="#fffdf2" stroke="#243142" stroke-width="3"/><ellipse cx="65" cy="24" rx="9" ry="23" fill="#fffdf2" stroke="#243142" stroke-width="3"/><ellipse cx="35" cy="26" rx="4" ry="14" fill="#f7a9c4"/><ellipse cx="65" cy="26" rx="4" ry="14" fill="#f7a9c4"/><circle cx="50" cy="55" r="31" fill="#fffdf2" stroke="#243142" stroke-width="3"/>${face}<path d="M45 55 L50 59 L55 55" ${line}/>`,
    hamster: `<circle cx="27" cy="33" r="12" fill="#c99161" stroke="#243142" stroke-width="3"/><circle cx="73" cy="33" r="12" fill="#c99161" stroke="#243142" stroke-width="3"/><circle cx="50" cy="55" r="32" fill="#d9a678" stroke="#243142" stroke-width="3"/><ellipse cx="50" cy="62" rx="16" ry="11" fill="#fffdf2"/>${face}<path d="M26 61 H13 M74 61 H87 M27 68 H15 M73 68 H85" ${line} opacity=".75"/>`,
    cat: `<path d="M22 39 L31 15 L45 38 Z" fill="#b98bdf" stroke="#243142" stroke-width="3"/><path d="M55 38 L69 15 L78 39 Z" fill="#b98bdf" stroke="#243142" stroke-width="3"/><circle cx="50" cy="55" r="32" fill="#d0b0f2" stroke="#243142" stroke-width="3"/>${face}<path d="M24 58 H12 M76 58 H88 M25 66 H14 M75 66 H86" ${line} opacity=".75"/>`,
    dog: `<ellipse cx="25" cy="42" rx="12" ry="22" fill="#8f6b4f" stroke="#243142" stroke-width="3"/><ellipse cx="75" cy="42" rx="12" ry="22" fill="#8f6b4f" stroke="#243142" stroke-width="3"/><circle cx="50" cy="55" r="32" fill="#c99161" stroke="#243142" stroke-width="3"/><ellipse cx="50" cy="61" rx="15" ry="11" fill="#fffdf2"/>${face}<circle cx="50" cy="57" r="3.5" fill="#243142"/>`,
    turtle: `<ellipse cx="50" cy="58" rx="34" ry="28" fill="#7bc47f" stroke="#243142" stroke-width="3"/><circle cx="50" cy="39" r="18" fill="#a7dc94" stroke="#243142" stroke-width="3"/>${face}`,
    goldfish: `<path d="M19 55 L5 37 Q26 42 26 55 Q26 68 5 73 Z" fill="#ffb347" stroke="#243142" stroke-width="3"/><ellipse cx="53" cy="55" rx="34" ry="25" fill="#ffcb69" stroke="#243142" stroke-width="3"/>${face}<path d="M78 55 L91 46 M78 55 L91 64" ${line}/>`,
    baseball: `<circle cx="50" cy="52" r="35" fill="#fffdf2" stroke="#243142" stroke-width="3"/><path d="M25 30 Q41 52 25 74 M75 30 Q59 52 75 74" stroke="#e35d5d" stroke-width="4" fill="none" stroke-dasharray="3 6"/>${sportsFace}`,
    basketball: `<circle cx="50" cy="52" r="35" fill="#f59e47" stroke="#243142" stroke-width="3"/><path d="M16 52 H84 M50 17 V87 M25 28 Q50 52 25 76 M75 28 Q50 52 75 76" ${line} opacity=".55"/>${sportsFace}`,
    tennis: `<circle cx="50" cy="52" r="35" fill="#dff56a" stroke="#243142" stroke-width="3"/><path d="M23 30 Q43 52 23 74 M77 30 Q57 52 77 74" stroke="#fffdf2" stroke-width="5" fill="none"/>${sportsFace}`,
    badminton: `<path d="M37 18 H63 L72 70 Q50 86 28 70 Z" fill="#fffdf2" stroke="#243142" stroke-width="3"/><path d="M37 18 L28 70 M46 18 L41 78 M54 18 L59 78 M63 18 L72 70 M30 57 H70" ${line} opacity=".35"/>${sportsFace}`,
    football: `<ellipse cx="50" cy="52" rx="39" ry="25" fill="#9b6846" stroke="#243142" stroke-width="3"/><path d="M35 52 H65 M41 44 V60 M50 44 V60 M59 44 V60" stroke="#fffdf2" stroke-width="4" stroke-linecap="round"/>${sportsFace}`,
    soccer: `<circle cx="50" cy="52" r="35" fill="#fffdf2" stroke="#243142" stroke-width="3"/><path d="M50 31 L65 43 L59 62 H41 L35 43 Z" fill="#243142"/><path d="M50 17 V31 M65 43 L82 38 M59 62 L69 79 M41 62 L31 79 M35 43 L18 38" ${line}/>${sportsFace}`,
  };
  return bodies[kind] || bodies.rabbit;
}

function playButtonClick() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  clickAudioContext = clickAudioContext || new AudioContext();
  const now = clickAudioContext.currentTime;
  const oscillator = clickAudioContext.createOscillator();
  const gain = clickAudioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(720, now);
  oscillator.frequency.exponentialRampToValueAtTime(360, now + .055);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.13, now + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .075);
  oscillator.connect(gain);
  gain.connect(clickAudioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + .08);
}

function bounceButton(button) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  button.classList.remove("button-bounce");
  void button.offsetWidth;
  button.classList.add("button-bounce");
}

function effectOrigin(element) {
  const rect = element?.getBoundingClientRect?.() || { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function addEffectNode(className, x, y, styles = {}, child = "") {
  const node = document.createElement("span");
  node.className = className;
  node.style.setProperty("--x", `${x}px`);
  node.style.setProperty("--y", `${y}px`);
  Object.entries(styles).forEach(([key, value]) => node.style.setProperty(key, value));
  node.innerHTML = child;
  $("effects").appendChild(node);
  node.addEventListener("animationend", () => node.remove(), { once: true });
}

function burstCelebrate(element) {
  const { x, y } = effectOrigin(element);
  const colors = ["#f7a9c4", "#a8d0f0", "#dff5d8", "#fff3b8", "#e7dcff"];
  for (let i = 0; i < 7; i += 1) {
    const angle = (Math.PI * 2 * i) / 7;
    const distance = 38 + (i % 3) * 18;
    addEffectNode("flower-pop", x, y, {
      "--dx": `${Math.cos(angle) * distance}px`,
      "--dy": `${Math.sin(angle) * distance - 18}px`,
      "--spin": `${i % 2 ? "-" : ""}${120 + i * 18}deg`,
    });
  }
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    const distance = 46 + (i % 4) * 14;
    addEffectNode("firework-spark", x, y, {
      "--dx": `${Math.cos(angle) * distance}px`,
      "--dy": `${Math.sin(angle) * distance}px`,
      "--spark-color": colors[i % colors.length],
    });
  }
}

function butterflyBreak(element) {
  const { x, y } = effectOrigin(element);
  const colors = ["#f7a9c4", "#a8d0f0", "#e7dcff", "#fff3b8", "#dff5d8"];
  for (let i = 0; i < 16; i += 1) {
    const angle = -Math.PI + (Math.PI * 2 * i) / 16;
    const distance = 80 + (i % 5) * 22;
    addEffectNode("butterfly-piece", x, y, {
      "--dx": `${Math.cos(angle) * distance}px`,
      "--dy": `${Math.sin(angle) * distance - 44}px`,
      "--spin": `${i % 2 ? "-" : ""}${80 + i * 14}deg`,
      "--wing-color": colors[i % colors.length],
    }, "<span></span>");
  }
}

function show(text) {
  $("output").textContent = text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function countryFromLabel(label) {
  const parts = String(label || "").split(",").map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function regionFromLabel(label) {
  const parts = String(label || "").split(",").map(part => part.trim()).filter(Boolean);
  return parts.length > 2 ? parts[parts.length - 2] : "";
}

init();
