const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SAFETY_TERMS = "attack shooting assault wildfire storm flood emergency public safety warning";
const TRAFFIC_TERMS = "major traffic accident road closure transit disruption crash";
const FOOD_HEALTH_TERMS = "food safety recall health alert boil water advisory contamination";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST." });
    return;
  }

  try {
    const body = await readJson(request);
    const contact = body.contact || {};
    const location = String(body.location || contact.area || contact.cityRegion || "").trim();
    if (!location) {
      sendJson(response, 400, { error: "A contact location is required." });
      return;
    }

    const place = await geocode(location);
    const categories = {
      Weather: [],
      "Safety News": [],
      Traffic: [],
      "Food/Health Alerts": [],
      "General Local Updates": [],
    };

    if (place) {
      categories.Weather.push(...await weatherItems(place));
      if (place.country === "United States") {
        categories.Weather.push(...await usWeatherAlerts(place));
      }
    } else {
      categories.Weather.push({
        title: "Weather unavailable",
        summary: "Could not find coordinates for this location from the public geocoding source.",
      });
    }

    categories["Safety News"].push(...await gdeltItems(location, SAFETY_TERMS));
    categories.Traffic.push(...await gdeltItems(location, TRAFFIC_TERMS));
    categories["Food/Health Alerts"].push(...await gdeltItems(location, FOOD_HEALTH_TERMS));
    categories["General Local Updates"].push(...await gdeltItems(location, "local emergency alert warning"));

    sendJson(response, 200, {
      location: place?.label || location,
      generatedAt: new Date().toISOString(),
      note: "This is a public-source summary, not an emergency alert service. No AI-generated claims are added when sources are unavailable.",
      categories,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Safety check failed." });
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, CORS_HEADERS);
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", chunk => {
      raw += chunk;
      if (raw.length > 20000) reject(new Error("Request body is too large."));
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    request.on("error", reject);
  });
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 9000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "TimeZonePlannerSafetyCheck/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(location) {
  const params = new URLSearchParams({ name: location, count: "1", language: "en", format: "json" });
  try {
    const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    const item = data.results?.[0];
    if (!item) return null;
    return {
      label: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country || "",
      timezone: item.timezone || "",
    };
  } catch {
    return null;
  }
}

async function weatherItems(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "weather_code,precipitation,wind_speed_10m,wind_gusts_10m",
    forecast_days: "1",
    timezone: "auto",
  });
  try {
    const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    const current = data.current || {};
    const concerns = [];
    const wind = Number(current.wind_speed_10m || 0);
    const gusts = Number(current.wind_gusts_10m || 0);
    const precipitation = Number(current.precipitation || 0);
    if (wind >= 50 || gusts >= 70) concerns.push("strong wind");
    if (precipitation >= 10) concerns.push("heavy precipitation");
    return [{
      title: concerns.length ? `Possible weather concern: ${concerns.join(", ")}` : "No extreme weather signal found in current public forecast data",
      summary: `Weather code ${current.weather_code ?? "unknown"}; wind ${current.wind_speed_10m ?? "unknown"} km/h; gusts ${current.wind_gusts_10m ?? "unknown"} km/h; precipitation ${current.precipitation ?? "unknown"} mm.`,
      url: `https://open-meteo.com/`,
    }];
  } catch {
    return [];
  }
}

async function usWeatherAlerts(place) {
  try {
    const data = await fetchJson(`https://api.weather.gov/alerts/active?point=${place.latitude},${place.longitude}`);
    return (data.features || []).slice(0, 5).map(feature => {
      const props = feature.properties || {};
      return {
        title: props.event || "Weather alert",
        summary: props.headline || props.description || "Official National Weather Service alert.",
        url: props.uri || "https://www.weather.gov/alerts",
      };
    });
  } catch {
    return [];
  }
}

async function gdeltItems(location, terms) {
  const params = new URLSearchParams({
    query: `"${location}" (${terms})`,
    mode: "ArtList",
    format: "json",
    timespan: "3d",
    maxrecords: "5",
    sort: "datedesc",
  });
  try {
    const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`);
    return (data.articles || []).slice(0, 5).map(article => ({
      title: article.title || "Local update",
      summary: [article.domain, article.seendate].filter(Boolean).join(", "),
      url: article.url || "",
    }));
  } catch {
    return [];
  }
}
