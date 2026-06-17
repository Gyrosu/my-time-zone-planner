const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SAFETY_QUERY =
  "attack shooting assault wildfire storm flood emergency public safety warning traffic accident road closure food safety recall health alert";

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

    const categories = {
      Weather: [],
      "Safety News": [],
      Traffic: [],
      "Food/Health Alerts": [],
      "General Local Updates": [],
    };

    const place = await geocode(location);

    const [weather, alerts, news] = await Promise.all([
      place ? weatherItems(place) : Promise.resolve([{
        title: "Weather unavailable",
        summary: "Could not find coordinates for this location.",
      }]),
      place && place.country === "United States" ? usWeatherAlerts(place) : Promise.resolve([]),
      gdeltItems(location, SAFETY_QUERY),
    ]);

    categories.Weather.push(...weather, ...alerts);
    categories["Safety News"].push(...news.slice(0, 3));
    categories.Traffic.push(...news.filter(item =>
      /traffic|accident|crash|road|closure/i.test(item.title + " " + item.summary)
    ).slice(0, 3));
    categories["Food/Health Alerts"].push(...news.filter(item =>
      /food|recall|health|water|contamination/i.test(item.title + " " + item.summary)
    ).slice(0, 3));
    categories["General Local Updates"].push(...news.slice(0, 5));

    sendJson(response, 200, {
      location: place?.label || location,
      generatedAt: new Date().toISOString(),
      note: "This is a public-source summary, not an emergency alert service.",
      categories,
    });
  } catch (error) {
    sendJson(response, 200, {
      error: "Safety check partially failed.",
      detail: error.message || "Unknown error.",
      categories: {
        Weather: [],
        "Safety News": [],
        Traffic: [],
        "Food/Health Alerts": [],
        "General Local Updates": [],
      },
    });
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

async function fetchJson(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TimeZonePlannerSafetyCheck/1.0" },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(location) {
  const params = new URLSearchParams({
    name: location,
    count: "1",
    language: "en",
    format: "json",
  });

  try {
    const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`, 4000);
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
    const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`, 4000);
    const current = data.current || {};

    return [{
      title: "Current public weather data",
      summary: `Weather code ${current.weather_code ?? "unknown"}; wind ${current.wind_speed_10m ?? "unknown"} km/h; gusts ${current.wind_gusts_10m ?? "unknown"} km/h; precipitation ${current.precipitation ?? "unknown"} mm.`,
      url: "https://open-meteo.com/",
    }];
  } catch {
    return [{
      title: "Weather unavailable",
      summary: "The public weather source did not respond in time.",
    }];
  }
}

async function usWeatherAlerts(place) {
  try {
    const data = await fetchJson(
      `https://api.weather.gov/alerts/active?point=${place.latitude},${place.longitude}`,
      4000
    );

    return (data.features || []).slice(0, 3).map(feature => {
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
    maxrecords: "6",
    sort: "datedesc",
  });

  try {
    const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, 4000);

    return (data.articles || []).slice(0, 6).map(article => ({
      title: article.title || "Local update",
      summary: [article.domain, article.seendate].filter(Boolean).join(", "),
      url: article.url || "",
    }));
  } catch {
    return [{
      title: "News unavailable",
      summary: "The public news source did not respond in time.",
    }];
  }
}
