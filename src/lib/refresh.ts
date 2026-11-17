import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { externalKey } from "@/lib/shows";
import type { Profile, RefreshSummary } from "@/lib/types";

type Candidate = {
  title: string;
  city: "nyc" | "london";
  tier: string;
  venue?: string | null;
  status?: string | null;
  previewsFrom?: string | null;
  opening?: string | null;
  closing?: string | null;
  writer?: string | null;
  director?: string | null;
  cast?: string | null;
  ticketUrl?: string | null;
  sourceUrl: string;
  detailUrl?: string | null;
};

export const sources = [
  {
    url: "https://playbill.com/article/whats-currently-playing-on-broadway",
    city: "nyc" as const,
    tier: "broadway",
    kind: "playbill-article",
    status: "Running"
  },
  {
    url: "https://playbill.com/article/schedule-of-upcoming-and-announced-broadway-shows",
    city: "nyc" as const,
    tier: "broadway",
    kind: "playbill-schedule",
    status: "Upcoming"
  },
  {
    url: "https://playbill.com/shows/offbroadway",
    city: "nyc" as const,
    tier: "off-broadway",
    kind: "playbill-cards",
    status: "Running"
  },
  {
    url: "https://playbill.com/article/schedule-of-upcoming-off-broadway-shows-2",
    city: "nyc" as const,
    tier: "off-broadway",
    kind: "playbill-schedule",
    status: "Upcoming"
  },
  {
    url: "https://sohorep.org/next/",
    city: "nyc" as const,
    tier: "off-off-broadway",
    kind: "soho-rep",
    status: "Upcoming",
    venue: "Soho Rep"
  },
  {
    url: "https://thetanknyc.org/calendar-1",
    city: "nyc" as const,
    tier: "off-off-broadway",
    kind: "squarespace-events",
    status: "Upcoming",
    venue: "The Tank"
  },
  {
    url: "https://playbill.com/shows/london",
    city: "london" as const,
    tier: "west-end",
    kind: "playbill-cards",
    status: "Running"
  },
  {
    url: "https://www.royalcourttheatre.com/whats-on/",
    city: "london" as const,
    tier: "off-west-end",
    kind: "royal-court",
    status: "Upcoming"
  },
  {
    url: "https://www.bushtheatre.co.uk/whats-on/",
    city: "london" as const,
    tier: "off-west-end",
    kind: "generic",
    status: "Upcoming",
    venue: "Bush Theatre"
  }
] as const;

const authoritativeCurrentCatalogs = new Set([
  "https://playbill.com/article/whats-currently-playing-on-broadway",
  "https://playbill.com/shows/offbroadway",
  "https://playbill.com/shows/london"
]);

function normalized(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function absoluteUrl(href: string | undefined, base: string) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function playbillArticle(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $("p").each((_, element) => {
    const block = $(element);
    const title = block.find("strong em, em strong").first().text().replace(/\s+/g, " ").trim();
    if (!title || title.length > 140) return;
    const text = block.text().replace(/\s+/g, " ").trim();
    const venueLink = block.find('a[href*="/venue/"]').last();
    const ticketLink = block.find("a").filter((__, anchor) => {
      const href = $(anchor).attr("href") || "";
      return !href.includes("playbill.com/article") && !href.includes("playbill.com/venue");
    }).last();
    const opened = text.match(/Open(?:ed|ing)(?: Night)?\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
    const previews = text.match(/Previews(?: begin| from)?\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
    const closes = text.match(/(?:Closes|Closing|Through)\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue: venueLink.text().trim() || null,
      status: source.status,
      previewsFrom: parseDate(previews),
      opening: parseDate(opened),
      closing: parseDate(closes),
      ticketUrl: absoluteUrl(ticketLink.attr("href"), source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
}

const smallWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);
const romanNumeral = /^(?=[IVXLC]+$)C{0,3}(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

// Playbill now prints upcoming titles in capitals ("THE FANTASTICKS").
export function tidyTitle(title: string) {
  if (!/[A-Z]/.test(title) || title !== title.toUpperCase()) return title;
  const words = title.toLowerCase().split(" ");
  return words
    .map((word, index) => {
      const letters = word.replace(/[^a-z]/g, "");
      // Keep numerals like "Henry VI" in capitals.
      if (letters && /^[ivxlc]+[^a-z]*$/.test(word) && romanNumeral.test(letters.toUpperCase())) {
        return word.toUpperCase();
      }
      // Small words stay lower case, except first or after a colon or dash.
      const previous = words[index - 1] ?? "";
      const startsPhrase = index === 0 || /[:–—-]$/.test(previous);
      if (!startsPhrase && smallWords.has(word)) return word;
      return word.replace(/\p{L}/u, (letter) => letter.toUpperCase());
    })
    .join(" ");
}

// Turns "February 20 - March 21" (no year) into ISO dates, choosing the
// soonest run that has not already finished.
export function seasonRange(text: string, today = new Date()) {
  const match = text.match(/([A-Z][a-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*[-–—]\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (!match) return { opening: null, closing: null };
  const [, startMonth, startDay, startYear, endMonthRaw, endDay, endYear] = match;
  const endMonth = endMonthRaw || startMonth;
  const todayIso = today.toISOString().slice(0, 10);
  for (const year of [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    const opening = parseDate(`${startMonth} ${startDay}, ${startYear || year}`);
    let closing = parseDate(`${endMonth} ${endDay}, ${endYear || startYear || year}`);
    if (opening && closing && closing < opening && !endYear) {
      closing = parseDate(`${endMonth} ${endDay}, ${Number(startYear || year) + 1}`);
    }
    if (opening && closing && (closing >= todayIso || startYear)) return { opening, closing };
  }
  return { opening: null, closing: null };
}

function playbillSchedule(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $("p").each((_, element) => {
    const block = $(element);
    const rawTitle = block.find("strong").first().text().replace(/\s+/g, " ").trim();
    if (!rawTitle || rawTitle.length > 140) return;
    const lines = (block.html() || "")
      .split(/<br\s*\/?>/i)
      .map((line) => cheerio.load(`<div>${line}</div>`)("div").text().replace(/\s+/g, " ").replace(/^[•·]\s*/, "").trim())
      .filter(Boolean);
    const field = (pattern: RegExp) => {
      for (const line of lines) {
        const found = line.match(pattern);
        if (found) return found[1].trim() || null;
      }
      return null;
    };
    const previews = field(/^First Previews?:\s*(.+)$/i);
    const opening = field(/^Opening(?: Night)?:\s*(.+)$/i);
    const closing = field(/^Closing(?: Night)?:\s*(.+)$/i);
    const labelledVenue = field(/^(?:Theatre|Theater|Venue):\s*(.+)$/i);
    // Off-Broadway entries list the venue as the first unlabelled line.
    const venue = labelledVenue || lines.slice(1).find((line) => !line.includes(":") && line.length < 120) || null;
    if (!previews && !opening && !labelledVenue) return;
    const ticketLink = block.find("a[href]").filter((__, anchor) => {
      const href = $(anchor).attr("href") || "";
      return !href.includes("playbill.com");
    }).last();
    const articleLink = block.find('a[href*="playbill.com/article"]').first();
    candidates.push({
      title: tidyTitle(rawTitle),
      city: source.city,
      tier: source.tier,
      venue,
      status: source.status,
      previewsFrom: parseDate(previews),
      opening: parseDate(opening),
      closing: parseDate(closing),
      writer: field(/^(?:Writers?|Playwrights?|Book(?: and [^:]+)?):\s*(.+)$/i),
      director: field(/^Directors?:\s*(.+)$/i),
      cast: field(/^(?:Starring|Cast):\s*(.+)$/i),
      ticketUrl: absoluteUrl(ticketLink.attr("href") || articleLink.attr("href"), source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
}

// Squarespace event calendars (The Tank).
function squarespaceEvents(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $("article.eventlist-event--upcoming").each((_, element) => {
    const card = $(element);
    const link = card.find(".eventlist-title a, a.eventlist-title-link").first();
    const title = (link.text() || card.find(".eventlist-title").first().text()).replace(/\s+/g, " ").trim();
    if (!title || title.length > 160) return;
    const dates = card.find("time.event-date").map((__, time) => $(time).attr("datetime")).get();
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue: "venue" in source ? source.venue : null,
      status: source.status,
      opening: parseDate(dates[0]),
      closing: parseDate(dates.at(-1)),
      ticketUrl: absoluteUrl(link.attr("href"), source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
}

// Soho Rep's season page: each show is a link with a date range and an <h3> title.
function sohoRepSeason(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $('a[href*="/shows/"]').each((_, element) => {
    const card = $(element);
    const title = card.find("h3").first().text().replace(/\s+/g, " ").trim();
    // Skip transfers elsewhere, e.g. "Watch Me Walk @ Yale Rep".
    if (!title || title.includes(" @ ")) return;
    const { opening, closing } = seasonRange(card.find("p").first().text().replace(/\s+/g, " ").trim());
    const text = card.text().replace(/\s+/g, " ");
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue: "Soho Rep",
      status: source.status,
      opening,
      closing,
      writer: text.match(/written by ([^,(.]+?)(?:\s*\(|,| and directed| directed|\.)/i)?.[1]?.trim() || null,
      director: text.match(/directed by ([^,(.]+?)(?:\s*\(|,|\.|$)/i)?.[1]?.trim() || null,
      ticketUrl: absoluteUrl(card.attr("href"), source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
}

export function playbillCards(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $('h3 a[href*="/production/"]').each((_, element) => {
    const anchor = $(element);
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!title || title.length > 140) return;
    const card = anchor.closest("h3").parent();
    const text = card.text().replace(/\s+/g, " ").trim();
    const previews = text.match(/Begins Previews\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)?.[1];
    const opens = text.match(/Opens\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)?.[1];
    const closes = text.match(/Closes\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)?.[1];
    const venue = card.find("ul li:not([role='presentation'])").last().text().trim() || null;
    const detailUrl = absoluteUrl(anchor.attr("href"), source.url);
    const buyLink = card.find("a[href]").filter((__, link) => {
      const href = $(link).attr("href") || "";
      return !href.includes("playbill.com") && !href.startsWith("/production/");
    }).last();
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue,
      status: previews ? "Upcoming" : source.status,
      previewsFrom: parseDate(previews),
      opening: parseDate(opens),
      closing: parseDate(closes),
      ticketUrl: absoluteUrl(buyLink.attr("href"), source.url) || detailUrl,
      sourceUrl: source.url,
      detailUrl
    });
  });
  return candidates;
}

export function playbillProductionDates(html: string) {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const dateAfter = (label: string) => {
    const match = text.match(new RegExp(`${label}\\s*([A-Z]{3,9})\\s*(\\d{1,2})\\s*(\\d{4})`, "i"));
    return match ? parseDate(`${match[1]} ${match[2]}, ${match[3]}`) : null;
  };
  return {
    previewsFrom: dateAfter("FIRST PREVIEW"),
    opening: dateAfter("OPENING DATE"),
    closing: dateAfter("CLOSING DATE")
  };
}

async function fetchPlaybillProductionDates(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Folly Productions listings refresh/1.0 (+https://www.follyproductions.com)"
      },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return playbillProductionDates(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

function royalCourt(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $(".c-media").each((_, element) => {
    const card = $(element);
    const title = card.find(".c-media__title").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;
    const credit = card.find(".c-media__posttitle").text().replace(/\s+/g, " ").trim();
    const times = card.find("time").map((__, time) => $(time).attr("datetime")).get();
    const href = card.closest("a").attr("href") || card.find('a[href*="/events/"]').attr("href");
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue: "Royal Court Theatre",
      status: source.status,
      opening: parseDate(times[0]),
      closing: parseDate(times.at(-1)),
      writer: credit.match(/Written by (.*?)(?:\.|, translated|, revised|$)/i)?.[1] || null,
      director: credit.match(/Directed by (.*?)(?:\.|$)/i)?.[1] || null,
      ticketUrl: absoluteUrl(href, source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
}

function genericCards(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $("article, li, [class*='event'], [class*='production']").each((_, element) => {
    const card = $(element);
    const heading = card.find("h2, h3, h4").first();
    const title = heading.text().replace(/\s+/g, " ").trim();
    const href = card.find("a[href]").first().attr("href");
    if (!title || title.length < 2 || title.length > 120 || !href) return;
    const times = card.find("time").map((__, time) => $(time).attr("datetime")).get();
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue: "venue" in source ? source.venue : null,
      status: source.status,
      opening: parseDate(times[0]),
      closing: parseDate(times.at(-1)),
      ticketUrl: absoluteUrl(href, source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
}

export async function fetchSource(source: (typeof sources)[number]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(source.url, {
      headers: {
        "user-agent": "Folly Productions listings refresh/1.0 (+https://www.follyproductions.com)"
      },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    const parsers: Record<string, (page: string, from: typeof source) => Candidate[]> = {
      "playbill-article": playbillArticle,
      "playbill-schedule": playbillSchedule,
      "playbill-cards": playbillCards,
      "royal-court": royalCourt,
      "squarespace-events": squarespaceEvents,
      "soho-rep": sohoRepSeason
    };
    const raw = (parsers[source.kind] ?? genericCards)(html, source);
    if (source.kind === "playbill-cards") {
      const detailed = raw.filter(
        (candidate): candidate is Candidate & { detailUrl: string } => Boolean(candidate.detailUrl)
      );
      let nextDetail = 0;
      const workerCount = Math.min(12, detailed.length);
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextDetail < detailed.length) {
          const candidate = detailed[nextDetail++];
          try {
            const dates = await fetchPlaybillProductionDates(candidate.detailUrl);
            candidate.previewsFrom = dates.previewsFrom || candidate.previewsFrom;
            candidate.opening = dates.opening || candidate.opening;
            candidate.closing = dates.closing || candidate.closing;
          } catch {
            // Catalogue dates remain useful if a detail page is temporarily unavailable.
          }
        }
      }));
    }
    const unique = new Map<string, Candidate>();
    for (const candidate of raw) {
      const key = normalized(candidate.title);
      if (!unique.has(key)) unique.set(key, candidate);
    }
    const candidates = [...unique.values()];
    if (candidates.length === 0) throw new Error("No listings could be parsed");
    return candidates;
  } finally {
    clearTimeout(timeout);
  }
}

// profile is null when the daily scheduled refresh runs it.
export async function refreshListings(profile: Profile | null): Promise<RefreshSummary> {
  const sql = db();
  const recent = await sql.query(
    `SELECT id FROM refresh_runs
      WHERE started_at > now() - interval '5 minutes'
        AND status = 'running'
      LIMIT 1`
  );
  if (recent.length) throw new Error("REFRESH_IN_PROGRESS");

  const run = await sql.query(
    `INSERT INTO refresh_runs (initiated_by, status)
     VALUES ($1, 'running') RETURNING id`,
    [profile?.id ?? null]
  );
  const runId = String(run[0].id);
  const summary: RefreshSummary = {
    added: 0,
    updated: 0,
    archived: 0,
    verified: 0,
    errors: [],
    finishedAt: ""
  };

  try {
    const results = await Promise.allSettled(sources.map(fetchSource));
    const candidates: Candidate[] = [];
    const successfulCurrentCatalogs = new Map<string, Set<string>>();
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        candidates.push(...result.value);
        const source = sources[index];
        if (authoritativeCurrentCatalogs.has(source.url) && result.value.length >= 5) {
          successfulCurrentCatalogs.set(
            source.url,
            new Set(result.value.map((candidate) => normalized(candidate.title)))
          );
        }
      }
      else summary.errors.push(`${new URL(sources[index].url).hostname}: ${result.reason instanceof Error ? result.reason.message : "failed"}`);
    });

    const existing = await sql.query(
      `SELECT id, title, city, venue, status, previews_from, opening, closing,
              writer, director, cast_members, ticket_url, source_url, archived
         FROM shows`
    );
    const byTitle = new Map(
      existing.map((row) => [`${row.city}:${normalized(String(row.title))}`, row])
    );
    const allCandidateKeys = new Set(
      candidates.map((candidate) => `${candidate.city}:${normalized(candidate.title)}`)
    );

    for (const candidate of candidates) {
      const match = byTitle.get(`${candidate.city}:${normalized(candidate.title)}`);
      if (!match) {
        if (!candidate.venue && candidate.tier === "off-off-broadway") continue;
        const key = externalKey({
          city: candidate.city,
          title: candidate.title,
          venue: candidate.venue ?? null
        });
        const inserted = await sql.query(
          `INSERT INTO shows (
             external_key, title, tier, venue, status, previews_from, opening, closing,
             writer, director, cast_members, notable_cast, ticket_url, source_url,
             city, archived, last_verified_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,false,now())
           ON CONFLICT (external_key) DO NOTHING
           RETURNING id`,
          [
            key, candidate.title, candidate.tier, candidate.venue, candidate.status,
            candidate.previewsFrom, candidate.opening, candidate.closing,
            candidate.writer, candidate.director, candidate.cast,
            candidate.ticketUrl, candidate.sourceUrl, candidate.city
          ]
        );
        if (inserted.length) summary.added += 1;
        continue;
      }

      const fields = {
        venue: candidate.venue || match.venue,
        status: candidate.status || match.status,
        previews: candidate.previewsFrom || match.previews_from,
        opening: candidate.opening || match.opening,
        closing: candidate.closing || match.closing,
        writer: candidate.writer || match.writer,
        director: candidate.director || match.director,
        cast: candidate.cast || match.cast_members,
        ticket: candidate.ticketUrl || match.ticket_url,
        source: candidate.sourceUrl || match.source_url
      };
      const changed =
        String(fields.venue ?? "") !== String(match.venue ?? "") ||
        String(fields.status ?? "") !== String(match.status ?? "") ||
        String(fields.previews ?? "").slice(0, 10) !== String(match.previews_from ?? "").slice(0, 10) ||
        String(fields.opening ?? "").slice(0, 10) !== String(match.opening ?? "").slice(0, 10) ||
        String(fields.closing ?? "").slice(0, 10) !== String(match.closing ?? "").slice(0, 10) ||
        String(fields.writer ?? "") !== String(match.writer ?? "") ||
        String(fields.director ?? "") !== String(match.director ?? "");

      await sql.query(
        `UPDATE shows
            SET venue=$1, status=$2, previews_from=$3, opening=$4, closing=$5,
                writer=$6, director=$7, cast_members=$8,
                notable_cast=COALESCE(notable_cast, $8), ticket_url=$9, source_url=$10,
                archived=false, last_verified_at=now(), updated_at=CASE WHEN $11 THEN now() ELSE updated_at END
          WHERE id=$12`,
        [
          fields.venue, fields.status, fields.previews, fields.opening, fields.closing,
          fields.writer, fields.director, fields.cast, fields.ticket, fields.source,
          changed, match.id
        ]
      );
      summary.verified += 1;
      if (changed) summary.updated += 1;
    }

    const missingFromCurrentCatalog = existing
      .filter((row) => {
        const seenTitles = successfulCurrentCatalogs.get(String(row.source_url));
        if (!seenTitles) return false;
        const title = normalized(String(row.title));
        return !seenTitles.has(title) && !allCandidateKeys.has(`${row.city}:${title}`);
      })
      .map((row) => String(row.id));

    if (missingFromCurrentCatalog.length > 0) {
      const reconciled = await sql.query(
        `UPDATE shows
            SET archived=true, status='Closed', last_verified_at=now(), updated_at=now()
          WHERE id = ANY($1::uuid[])
            AND archived=false
          RETURNING id`,
        [missingFromCurrentCatalog]
      );
      summary.archived += reconciled.length;
    }

    const archived = await sql.query(
      `UPDATE shows
          SET archived=true, updated_at=now()
        WHERE archived=false
          AND closing < current_date
        RETURNING id`
    );
    summary.archived += archived.length;
    summary.finishedAt = new Date().toISOString();
    const status = summary.errors.length ? "partial" : "succeeded";
    await sql.query(
      `UPDATE refresh_runs
          SET status=$1, added_count=$2, updated_count=$3, archived_count=$4,
              verified_count=$5, errors=$6::jsonb, finished_at=now()
        WHERE id=$7`,
      [
        status, summary.added, summary.updated, summary.archived,
        summary.verified, JSON.stringify(summary.errors), runId
      ]
    );
    return summary;
  } catch (error) {
    await sql.query(
      `UPDATE refresh_runs
          SET status='failed', errors=$1::jsonb, finished_at=now()
        WHERE id=$2`,
      [JSON.stringify([error instanceof Error ? error.message : "Unknown refresh error"]), runId]
    );
    throw error;
  }
}
