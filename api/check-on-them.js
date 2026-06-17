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
  const known = KNOWN_PLACES[cleanLocationKey(location)];
  if (known) return known;

  for (const query of geocodeVariants(location)) {
    const params = new URLSearchParams({ name: query, count: "5", language: "en", format: "json" });
    try {
      const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      const item = bestGeocodeResult(data.results || [], location);
      if (!item) continue;
      return {
        label: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
        latitude: item.latitude,
        longitude: item.longitude,
        country: item.country || "",
        timezone: item.timezone || "",
      };
    } catch {
      continue;
    }
  }
  return null;
}

function cleanLocationKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function geocodeVariants(location) {
  const parts = String(location || "").split(",").map(part => part.trim()).filter(Boolean);
  const variants = [location];
  if (parts.length >= 2) variants.push(`${parts[0]} ${parts[1]}`);
  if (parts.length >= 1) variants.push(parts[0]);
  return Array.from(new Set(variants.filter(Boolean)));
}

function bestGeocodeResult(results, originalLocation) {
  if (!results.length) return null;
  const original = cleanLocationKey(originalLocation);
  const originalParts = original.split(" ");
  return results
    .map(item => {
      const label = cleanLocationKey([item.name, item.admin1, item.country].filter(Boolean).join(" "));
      const score = originalParts.reduce((sum, part) => sum + (label.includes(part) ? 1 : 0), 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)[0].item;
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
    return [{
      title: "News unavailable",
      summary: "The public news source did not respond in time. Use the link below for a manual check.",
      url: `https://news.google.com/search?q=${encodeURIComponent(`${location} ${terms}`)}`,
    }];
  }
}
