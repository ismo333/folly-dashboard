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
};

const sources = [
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
    kind: "playbill-article",
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
    kind: "playbill-article",
    status: "Upcoming"
  },
  {
    url: "https://sohorep.org/",
    city: "nyc" as const,
    tier: "off-off-broadway",
    kind: "generic",
    status: "Upcoming",
    venue: "Soho Rep"
  },
  {
    url: "https://thetanknyc.org/calendar-1",
    city: "nyc" as const,
    tier: "off-off-broadway",
    kind: "generic",
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
    const opened = text.match(/Opened\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
    const previews = text.match(/Previews(?: begin| from)?\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
    const closes = text.match(/(?:Closes|Through)\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
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

function playbillCards(html: string, source: (typeof sources)[number]): Candidate[] {
  const $ = cheerio.load(html);
  const candidates: Candidate[] = [];
  $('a[href*="/production/"]').each((_, element) => {
    const anchor = $(element);
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!title || title.length > 140) return;
    const card = anchor.closest("article, li, .bsp-list-promo, .production");
    const text = card.text().replace(/\s+/g, " ").trim();
    const venue =
      card.find('[class*="venue"]').first().text().trim() ||
      text.match(/(?:at|@)\s+([^|·]+?Theatre)/i)?.[1] ||
      null;
    candidates.push({
      title,
      city: source.city,
      tier: source.tier,
      venue,
      status: source.status,
      ticketUrl: absoluteUrl(anchor.attr("href"), source.url),
      sourceUrl: source.url
    });
  });
  return candidates;
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

async function fetchSource(source: (typeof sources)[number]) {
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
    const raw = source.kind === "playbill-article"
      ? playbillArticle(html, source)
      : source.kind === "playbill-cards"
        ? playbillCards(html, source)
        : source.kind === "royal-court"
          ? royalCourt(html, source)
          : genericCards(html, source);
    const unique = new Map<string, Candidate>();
    for (const candidate of raw) {
      const key = normalized(candidate.title);
      if (!unique.has(key)) unique.set(key, candidate);
    }
    return [...unique.values()];
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshListings(profile: Profile): Promise<RefreshSummary> {
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
    [profile.id]
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
    results.forEach((result, index) => {
      if (result.status === "fulfilled") candidates.push(...result.value);
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

    const archived = await sql.query(
      `UPDATE shows
          SET archived=true, updated_at=now()
        WHERE archived=false
          AND closing < current_date
        RETURNING id`
    );
    summary.archived = archived.length;
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
