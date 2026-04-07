/**
 * Website Crawler — dedicated HTTP service client for external website fetching.
 *
 * This service client contains all fetch logic, HTML parsing, and data extraction.
 * No module-specific business logic lives here.
 *
 * Architecture: server-only, never import in client code.
 * Spec: MOD_34 Section 5.3
 */

import * as cheerio from "cheerio";
import type {
  ExtractedData,
  LogoCandidate,
  ColorFound,
  ExtractedContact,
  ExtractedTexts,
  OpeningHours,
  WeekDay,
} from "@/modules/dna-engine/domain/types";

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "carlion.de",
  "carlion.app",
];

/**
 * Normalizes a URL: adds https:// if no scheme, removes trailing slash.
 * Throws if the URL is invalid or blocked.
 */
export function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.some((blocked) => host.includes(blocked))) {
    throw new Error(`URL not allowed: ${host}`);
  }
  // Block private IP ranges
  if (
    host.match(/^192\.168\./) ||
    host.match(/^10\./) ||
    host.match(/^172\.(1[6-9]|2\d|3[01])\./)
  ) {
    throw new Error(`Private IP addresses are not allowed`);
  }

  return parsed.origin + parsed.pathname.replace(/\/$/, "") + parsed.search;
}

// ---------------------------------------------------------------------------
// robots.txt check
// ---------------------------------------------------------------------------

/**
 * Returns true if the crawler is allowed to access the root URL.
 * Returns true on error (fail-open) — we don't want to block crawls due to
 * robots.txt fetch failures.
 */
export async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Carlion-Bot/1.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) return true; // No robots.txt = allow all

    const text = await res.text();
    const lines = text.split("\n").map((l) => l.trim().toLowerCase());

    let currentAgentApplies = false;
    for (const line of lines) {
      if (line.startsWith("user-agent:")) {
        const agent = line.split(":")[1]?.trim() ?? "";
        currentAgentApplies = agent === "*" || agent === "carlion-bot";
      }
      if (currentAgentApplies && line.startsWith("disallow:")) {
        const path = line.split(":")[1]?.trim() ?? "";
        if (path === "/" || path === "") return false;
      }
    }
    return true;
  } catch {
    return true; // Fail-open: allow crawl if robots.txt is unreachable
  }
}

// ---------------------------------------------------------------------------
// HTML fetch
// ---------------------------------------------------------------------------

export interface FetchResult {
  html: string;
  finalUrl: string;
}

/**
 * Fetches the HTML of a website's homepage.
 * Timeout: 8 seconds. Follows up to 3 redirects (native fetch does this).
 */
export async function fetchWebsiteHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Carlion-Bot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }

    const html = await res.text();
    return { html, finalUrl: res.url };
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === "AbortError") {
      throw new Error(`Fetch timeout after 8s for ${url}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HTML data extraction
// ---------------------------------------------------------------------------

/** Resolves a URL relative to a base URL. Returns null if resolution fails. */
function resolveUrl(href: string | undefined, baseUrl: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Extracts hex colors from a CSS string. */
function extractHexColors(css: string): string[] {
  const hexPattern = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = hexPattern.exec(css)) !== null) {
    const hex = match[0];
    // Normalize 3-char to 6-char
    if (hex.length === 4) {
      found.push(
        "#" + hex[1]!.repeat(2) + hex[2]!.repeat(2) + hex[3]!.repeat(2)
      );
    } else {
      found.push(hex.toUpperCase());
    }
  }
  return found;
}

/** Extracts phone number from a tel: link */
function normalizePhone(tel: string): string {
  return tel.replace(/^tel:/, "").trim();
}

/** Extracts email from a mailto: link */
function normalizeEmail(mailto: string): string {
  return mailto.replace(/^mailto:/, "").split("?")[0]?.trim() ?? "";
}

/**
 * Parses structured data from raw HTML.
 * Only parses the homepage — no deep-crawl, no sub-pages.
 */
export function extractDataFromHtml(
  html: string,
  baseUrl: string
): ExtractedData {
  const $ = cheerio.load(html);

  // ---- Logo candidates ----
  const logoCandidates: LogoCandidate[] = [];

  // Header/Nav images
  $("header img, nav img, [class*='logo'] img, [id*='logo'] img").each(
    (_, el) => {
      const src = resolveUrl($(el).attr("src"), baseUrl);
      if (src) logoCandidates.push({ url: src, context: "header" });
    }
  );

  // Open Graph image
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogImageUrl = resolveUrl(ogImage, baseUrl);
  if (ogImageUrl) logoCandidates.push({ url: ogImageUrl, context: "og_image" });

  // Link rel=icon / apple-touch-icon
  $('link[rel*="icon"]').each((_, el) => {
    const href = resolveUrl($(el).attr("href"), baseUrl);
    if (href) logoCandidates.push({ url: href, context: "favicon" });
  });

  // Schema.org logo
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      const logo = data?.logo?.url ?? data?.logo;
      if (typeof logo === "string") {
        const url = resolveUrl(logo, baseUrl);
        if (url) logoCandidates.push({ url, context: "schema_org" });
      }
    } catch {
      // Skip invalid JSON-LD
    }
  });

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const uniqueLogos = logoCandidates.filter((c) => {
    if (seenUrls.has(c.url)) return false;
    seenUrls.add(c.url);
    return true;
  });

  // ---- Colors ----
  const colorsFound: ColorFound[] = [];
  const colorFrequency = new Map<string, number>();

  // CSS custom properties in <style> tags
  $("style").each((_, el) => {
    const css = $(el).html() ?? "";
    // Custom properties
    const customPropPattern = /--[\w-]+\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g;
    let match: RegExpExecArray | null;
    while ((match = customPropPattern.exec(css)) !== null) {
      const hex = match[1]!.toUpperCase();
      colorFrequency.set(hex, (colorFrequency.get(hex) ?? 0) + 3); // Higher weight for CSS vars
    }
    // Other hex colors in CSS
    for (const hex of extractHexColors(css)) {
      colorFrequency.set(hex, (colorFrequency.get(hex) ?? 0) + 1);
    }
  });

  // Inline styles
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    for (const hex of extractHexColors(style)) {
      colorFrequency.set(hex, (colorFrequency.get(hex) ?? 0) + 2);
    }
  });

  // Filter out near-black and near-white (not useful as brand colors)
  for (const [hex, freq] of colorFrequency.entries()) {
    if (hex === "#FFFFFF" || hex === "#000000" || hex === "#FFF" || hex === "#000") continue;
    colorsFound.push({ hex, frequency: freq, context: "custom_prop" });
  }
  // Sort by frequency descending
  colorsFound.sort((a, b) => b.frequency - a.frequency);

  // ---- Texts ----
  const texts: ExtractedTexts = {
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() ??
      $('meta[property="og:description"]').attr("content")?.trim(),
    h1: $("h1").first().text().trim() || undefined,
    tagline: undefined,
    about: undefined,
  };

  // Try to find tagline from common patterns
  const taglineEl = $("[class*='tagline'], [class*='slogan'], [class*='claim']").first();
  if (taglineEl.length) {
    texts.tagline = taglineEl.text().trim() || undefined;
  }

  // ---- Contact ----
  const contact: ExtractedContact = {};

  // Phone from tel: links
  const telLink = $('a[href^="tel:"]').first().attr("href");
  if (telLink) contact.phone = normalizePhone(telLink);

  // Email from mailto: links
  const mailLink = $('a[href^="mailto:"]').first().attr("href");
  if (mailLink) contact.email = normalizeEmail(mailLink);

  // Schema.org LocalBusiness
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      if (
        data?.["@type"] === "LocalBusiness" ||
        data?.["@type"] === "AutoDealer"
      ) {
        if (!contact.phone && data.telephone) {
          contact.phone = String(data.telephone).trim();
        }
        if (!contact.email && data.email) {
          contact.email = String(data.email).trim();
        }
        if (!contact.address && data.address) {
          contact.address = {
            street: data.address.streetAddress,
            zip: data.address.postalCode,
            city: data.address.addressLocality,
          };
        }
      }
    } catch {
      // Skip invalid JSON-LD
    }
  });

  // ---- Opening Hours ----
  let openingHours: Partial<OpeningHours> | undefined;
  const dayMap: Record<string, WeekDay> = {
    Mo: "monday",
    Monday: "monday",
    Di: "tuesday",
    Tuesday: "tuesday",
    Mi: "wednesday",
    Wednesday: "wednesday",
    Do: "thursday",
    Thursday: "thursday",
    Fr: "friday",
    Friday: "friday",
    Sa: "saturday",
    Saturday: "saturday",
    So: "sunday",
    Sunday: "sunday",
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      const hours = data?.openingHoursSpecification;
      if (Array.isArray(hours)) {
        openingHours = openingHours ?? {};
        for (const spec of hours) {
          const dayNames: string[] = Array.isArray(spec.dayOfWeek)
            ? spec.dayOfWeek
            : [spec.dayOfWeek];
          for (const dayName of dayNames) {
            const day = dayMap[dayName as string];
            if (day) {
              openingHours[day] = {
                open: String(spec.opens ?? "09:00"),
                close: String(spec.closes ?? "18:00"),
                closed: false,
              };
            }
          }
        }
      }
    } catch {
      // Skip invalid JSON-LD
    }
  });

  return {
    logoCandidates: uniqueLogos,
    colorsFound,
    texts,
    contact,
    openingHours,
  };
}

// ---------------------------------------------------------------------------
// Logo download
// ---------------------------------------------------------------------------

/**
 * Downloads a logo candidate from a URL.
 * Timeout: 5 seconds. Max 5 MB.
 * Returns null on any failure — callers must handle gracefully.
 */
export async function downloadLogoCandidate(
  url: string
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Carlion-Bot/1.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    // Check content-length before downloading
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 5 * 1024 * 1024) return null;

    return Buffer.from(arrayBuffer);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
