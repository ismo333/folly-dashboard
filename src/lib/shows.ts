import { createHash } from "node:crypto";
import seedShows from "@/data/seed-shows.json";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/config";
import type { Comment, Profile, Review, Show } from "@/lib/types";

type SeedShow = {
  title: string;
  tier: string;
  venue: string | null;
  status: string | null;
  previews_from: string | null;
  opening: string | null;
  closing: string | null;
  writer: string | null;
  director: string | null;
  cast: string | null;
  new_writing: boolean | null;
  synopsis: string | null;
  ticket_url: string | null;
  source_url: string | null;
  city: "nyc" | "london";
};

export function externalKey(show: Pick<SeedShow, "city" | "title" | "venue">) {
  return [show.city, show.title, show.venue ?? ""]
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
    .join(":");
}

function localId(key: string) {
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}

function seedData(): Show[] {
  return (seedShows as SeedShow[]).map((show) => {
    const key = externalKey(show);
    return {
      id: localId(key),
      externalKey: key,
      title: show.title,
      tier: show.tier,
      venue: show.venue,
      status: show.status,
      previewsFrom: show.previews_from,
      opening: show.opening,
      closing: show.closing,
      writer: show.writer,
      director: show.director,
      cast: show.cast,
      notableCast: show.cast,
      writerAcclaim: null,
      newWriting: show.new_writing,
      synopsis: show.synopsis,
      ticketUrl: show.ticket_url,
      sourceUrl: show.source_url,
      city: show.city,
      archived: false,
      lastVerifiedAt: null,
      reviews: []
    };
  });
}

function isoDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isoTime(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function getShows(profile: Profile | null): Promise<Show[]> {
  if (!isDatabaseConfigured) return seedData();
  const sql = db();
  const showRows = await sql.query(
    `SELECT id, external_key, title, tier, venue, status, previews_from, opening,
            closing, writer, director, cast_members, notable_cast, writer_acclaim,
            new_writing, synopsis, ticket_url, source_url, city, archived,
            last_verified_at
       FROM shows
      ORDER BY archived, city, title`
  );

  const reviewsByShow = new Map<string, Review[]>();
  if (profile) {
    const reviewRows = await sql.query(
      `SELECT r.id, r.show_id, r.seen_on, r.rating, r.body, r.visibility,
              r.profile_id, r.created_at, r.updated_at, p.display_name
         FROM reviews r
         JOIN profiles p ON p.id = r.profile_id
        WHERE ($1 = 'owner' OR r.visibility = 'public')
        ORDER BY r.seen_on DESC, r.created_at DESC`,
      [profile.role]
    );
    const reviewIds = reviewRows.map((row) => String(row.id));
    const commentsByReview = new Map<string, Comment[]>();

    if (reviewIds.length > 0) {
      const commentRows = await sql.query(
        `SELECT c.id, c.review_id, c.body, c.profile_id, c.created_at, c.updated_at,
                p.display_name
           FROM comments c
           JOIN profiles p ON p.id = c.profile_id
          WHERE c.review_id = ANY($1::uuid[])
          ORDER BY c.created_at`,
        [reviewIds]
      );
      for (const row of commentRows) {
        const reviewId = String(row.review_id);
        const list = commentsByReview.get(reviewId) ?? [];
        list.push({
          id: String(row.id),
          body: String(row.body),
          authorId: String(row.profile_id),
          authorName: String(row.display_name),
          createdAt: isoTime(row.created_at),
          updatedAt: isoTime(row.updated_at),
          canEdit: String(row.profile_id) === profile.id
        });
        commentsByReview.set(reviewId, list);
      }
    }

    for (const row of reviewRows) {
      const showId = String(row.show_id);
      const list = reviewsByShow.get(showId) ?? [];
      list.push({
        id: String(row.id),
        showId,
        seenOn: isoDate(row.seen_on) ?? "",
        rating: row.rating == null ? null : Number(row.rating),
        body: String(row.body),
        visibility: row.visibility as Review["visibility"],
        authorId: String(row.profile_id),
        authorName: String(row.display_name),
        createdAt: isoTime(row.created_at),
        updatedAt: isoTime(row.updated_at),
        canEdit: String(row.profile_id) === profile.id,
        comments: commentsByReview.get(String(row.id)) ?? []
      });
      reviewsByShow.set(showId, list);
    }
  }

  return showRows.map((row) => ({
    id: String(row.id),
    externalKey: String(row.external_key),
    title: String(row.title),
    tier: String(row.tier),
    venue: row.venue ? String(row.venue) : null,
    status: row.status ? String(row.status) : null,
    previewsFrom: isoDate(row.previews_from),
    opening: isoDate(row.opening),
    closing: isoDate(row.closing),
    writer: row.writer ? String(row.writer) : null,
    director: row.director ? String(row.director) : null,
    cast: row.cast_members ? String(row.cast_members) : null,
    notableCast: row.notable_cast ? String(row.notable_cast) : null,
    writerAcclaim: row.writer_acclaim ? String(row.writer_acclaim) : null,
    newWriting: row.new_writing == null ? null : Boolean(row.new_writing),
    synopsis: row.synopsis ? String(row.synopsis) : null,
    ticketUrl: row.ticket_url ? String(row.ticket_url) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    city: row.city as Show["city"],
    archived: Boolean(row.archived),
    lastVerifiedAt: row.last_verified_at ? isoTime(row.last_verified_at) : null,
    reviews: reviewsByShow.get(String(row.id)) ?? []
  }));
}
