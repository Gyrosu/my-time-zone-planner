const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SAFETY_QUERY =
  "attack OR shooting OR assault OR wildfire OR fire OR flood OR storm OR emergency OR police warning OR road closure OR food recall OR health alert";

module.exports = async function handler(request, response) {
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

    const query = `"${location}" (${SAFETY_QUERY}) when:7d`;
    const searchUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}`;
    const rssUrl = `https://news.google.com/rss/search?${new URLSearchParams({
      q: query,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    })}`;

    const xml = await fetchText(rssUrl, 6500);
    const articles = parseRssItems(xml).slice(0, 10);

    sendJson(response, 200, {
      location,
      generatedAt: new Date().toISOString(),
      searchUrl,
      articles,
      note: articles.length
        ? "Articles are from Google News RSS search results for the past week. Review sources directly before relying on them."
        : "No Google News RSS articles were returned for this safety query in the past week.",
    });
  } catch (error) {
    const location = "location";
    sendJson(response, 200, {
      location,
      generatedAt: new Date().toISOString(),
      searchUrl: "",
      articles: [],
      note: `Could not fetch article results automatically: ${error.message || "request failed"}`,
    });
  }
};

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

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "TimeZonePlannerSafetyArticles/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseRssItems(xml) {
  const items = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const itemXml of itemMatches) {
    const title = decodeXml(textBetween(itemXml, "title"));
    const url = decodeXml(textBetween(itemXml, "link"));
    const published = decodeXml(textBetween(itemXml, "pubDate"));
    const source = decodeXml(textBetween(itemXml, "source"));
    if (!title || !url) continue;
    items.push({ title, url, published, source });
  }
  return items;
}

function textBetween(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
