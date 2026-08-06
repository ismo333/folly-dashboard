"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Profile, RefreshSummary, Review, Show } from "@/lib/types";

const tierLabels: Record<string, string> = {
  broadway: "Broadway",
  "off-broadway": "Off-Broadway",
  "off-off-broadway": "Off-Off",
  "west-end": "West End",
  "off-west-end": "Off West End / Fringe"
};

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function startDate(show: Show) {
  return show.previewsFrom || show.opening;
}

function overlaps(show: Show, from: string, to: string) {
  const starts = startDate(show);
  if (to && starts && starts > to) return false;
  if (from && show.closing && show.closing < from) return false;
  return true;
}

function exactRun(show: Show) {
  const parts = [
    show.previewsFrom ? `Previews ${formatDate(show.previewsFrom)}` : null,
    show.opening ? `Opens ${formatDate(show.opening)}` : null,
    show.closing ? `Until ${formatDate(show.closing)}` : "Open-ended run"
  ].filter(Boolean);
  return parts.join(" · ");
}

async function jsonRequest(url: string, options: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}

export function Dashboard({
  initialShows,
  viewer,
  setupMode
}: {
  initialShows: Show[];
  viewer: Profile | null;
  setupMode: boolean;
}) {
  const [shows, setShows] = useState(initialShows);
  const [city, setCity] = useState<"nyc" | "london">("nyc");
  const [tiers, setTiers] = useState<Set<string>>(
    new Set(["broadway", "off-broadway", "off-off-broadway"])
  );
  const [query, setQuery] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<"listings" | "seen" | "private">("listings");
  const [selected, setSelected] = useState<Show | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshSummary | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const cityTiers = city === "nyc"
    ? ["broadway", "off-broadway", "off-off-broadway"]
    : ["west-end", "off-west-end"];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return shows.filter((show) => {
      if (show.city !== city || !tiers.has(show.tier) || show.archived) return false;
      if (newOnly && show.newWriting !== true) return false;
      if (!overlaps(show, from, to)) return false;
      if (view === "seen" && !show.reviews.some((review) => review.authorId === viewer?.id)) {
        return false;
      }
      if (view === "private" && !show.reviews.some((review) => review.visibility === "owners")) {
        return false;
      }
      if (!normalized) return true;
      return [
        show.title,
        show.venue,
        show.writer,
        show.director,
        show.cast,
        show.notableCast,
        show.writerAcclaim
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [shows, city, tiers, query, newOnly, from, to, view, viewer?.id]);

  function changeCity(next: "nyc" | "london") {
    setCity(next);
    setTiers(new Set(next === "nyc"
      ? ["broadway", "off-broadway", "off-off-broadway"]
      : ["west-end", "off-west-end"]));
  }

  function toggleTier(tier: string) {
    const next = new Set(tiers);
    if (next.has(tier) && next.size > 1) next.delete(tier);
    else next.add(tier);
    setTiers(next);
  }

  async function refresh() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const result = await jsonRequest("/api/refresh", { method: "POST" });
      setRefreshResult(result.summary);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Refresh failed.");
      setRefreshing(false);
    }
  }

  function updateSelected(show: Show) {
    setSelected(show);
    setShows((current) => current.map((item) => item.id === show.id ? show : item));
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="brand-lockup">
          <span className="brand-word">folly</span>
          <span className="brand-rule" />
          <span className="brand-product">What’s On</span>
        </div>
        <div className="header-actions">
          {viewer?.role === "owner" && (
            <button className="text-button light" onClick={() => setInviteOpen(true)}>
              Invite reviewers
            </button>
          )}
          {!setupMode && (
            <button className="text-button light" onClick={async () => {
              await fetch("/api/auth/sign-out", { method: "POST" });
              window.location.assign("/");
            }}>
              {viewer?.displayName} · Sign out
            </button>
          )}
          <button className="refresh-button" onClick={refresh} disabled={refreshing || setupMode}>
            <span className={refreshing ? "spin" : ""}>↻</span>
            {refreshing ? "Checking listings…" : "Refresh listings"}
          </button>
        </div>
      </header>

      {setupMode && (
        <div className="setup-banner">
          <strong>Preview mode.</strong> Add Neon environment variables and run the seed command
          to enable accounts, reviews, comments, and live refresh.
        </div>
      )}
      {refreshResult && (
        <div className="refresh-result">
          Refresh complete: {refreshResult.added} added, {refreshResult.updated} updated,
          {" "}{refreshResult.archived} archived, {refreshResult.verified} reconfirmed.
        </div>
      )}

      <section className="intro-row">
        <h1>See what’s on.<br /><i>Tell us what you thought.</i></h1>
        <p>
          New York and London listings, exact dates, notable artists, and the notes we
          want to remember.
        </p>
      </section>

      <nav className="view-tabs" aria-label="Dashboard sections">
        <button className={view === "listings" ? "active" : ""} onClick={() => setView("listings")}>
          Current listings
        </button>
        <button className={view === "seen" ? "active" : ""} onClick={() => setView("seen")}>
          My seen shows
        </button>
        {viewer?.role === "owner" && (
          <button className={view === "private" ? "active" : ""} onClick={() => setView("private")}>
            Private · Isobel &amp; Zsuzsa
          </button>
        )}
      </nav>

      <section className="filter-panel">
        <div className="city-switch">
          <button className={city === "nyc" ? "active" : ""} onClick={() => changeCity("nyc")}>
            New York
          </button>
          <button className={city === "london" ? "active" : ""} onClick={() => changeCity("london")}>
            London
          </button>
        </div>
        <div className="tier-row">
          {cityTiers.map((tier) => (
            <button
              key={tier}
              className={tiers.has(tier) ? "chip active" : "chip"}
              onClick={() => toggleTier(tier)}
            >
              {tierLabels[tier]}
            </button>
          ))}
          <label className="check-filter">
            <input type="checkbox" checked={newOnly} onChange={(event) => setNewOnly(event.target.checked)} />
            New writing
          </label>
        </div>
        <div className="range-row">
          <label>
            Playing from
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <span aria-hidden="true">→</span>
          <label>
            Through
            <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="search-field">
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, writer, cast, venue…"
            />
          </label>
        </div>
      </section>

      <div className="results-heading">
        <span>{filtered.length} shows</span>
        {(from || to) && <span>playing within your selected dates</span>}
      </div>

      <section className="show-grid">
        {filtered.map((show, index) => (
          <ShowCard
            key={show.id}
            show={show}
            index={index}
            viewer={viewer}
            onOpen={() => setSelected(show)}
          />
        ))}
      </section>

      {filtered.length === 0 && (
        <div className="empty-state">
          <span>Nothing in this combination—yet.</span>
          <button onClick={() => { setFrom(""); setTo(""); setQuery(""); setNewOnly(false); }}>
            Clear filters
          </button>
        </div>
      )}

      {selected && (
        <ShowDrawer
          show={selected}
          viewer={viewer}
          setupMode={setupMode}
          onClose={() => setSelected(null)}
          onChange={updateSelected}
        />
      )}
      {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
    </main>
  );
}

function ShowCard({
  show,
  index,
  viewer,
  onOpen
}: {
  show: Show;
  index: number;
  viewer: Profile | null;
  onOpen: () => void;
}) {
  const myVisits = show.reviews.filter((review) => review.authorId === viewer?.id);
  return (
    <article className={`show-card color-${index % 4}`} onClick={onOpen}>
      <div className="card-topline">
        <span>{tierLabels[show.tier] || show.tier}</span>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <h2>{show.title}</h2>
      <p className="venue">{show.venue || "Venue to be announced"}</p>
      <p className="run-dates">{exactRun(show)}</p>
      {(show.notableCast || show.writerAcclaim) && (
        <div className="notable">
          {show.notableCast && <p><b>Notable cast</b> {show.notableCast}</p>}
          {show.writerAcclaim && <p><b>Acclaimed writer</b> {show.writerAcclaim}</p>}
        </div>
      )}
      <div className="card-footer">
        <span>{show.newWriting ? "New writing" : show.writer ? `By ${show.writer}` : "Production"}</span>
        <span>
          {myVisits.length > 0 ? `Seen ${myVisits.length}×` : `${show.reviews.length} review${show.reviews.length === 1 ? "" : "s"}`} →
        </span>
      </div>
    </article>
  );
}

function ShowDrawer({
  show,
  viewer,
  setupMode,
  onClose,
  onChange
}: {
  show: Show;
  viewer: Profile | null;
  setupMode: boolean;
  onClose: () => void;
  onChange: (show: Show) => void;
}) {
  const [editing, setEditing] = useState<Review | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingPeople, setEditingPeople] = useState(false);

  async function removeReview(review: Review) {
    if (!window.confirm(`Delete your review from ${formatDate(review.seenOn)}? This cannot be undone.`)) return;
    await jsonRequest(`/api/reviews/${review.id}`, { method: "DELETE" });
    onChange({ ...show, reviews: show.reviews.filter((item) => item.id !== review.id) });
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="show-drawer" role="dialog" aria-modal="true" aria-label={show.title}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">{tierLabels[show.tier]} · {show.city === "nyc" ? "New York" : "London"}</p>
        <h2>{show.title}</h2>
        <p className="drawer-venue">{show.venue}</p>
        <div className="date-table">
          <div><span>Previews</span><b>{formatDate(show.previewsFrom) || "Not announced"}</b></div>
          <div><span>Opening</span><b>{formatDate(show.opening) || "Not announced"}</b></div>
          <div><span>Closing</span><b>{formatDate(show.closing) || "Open-ended"}</b></div>
        </div>
        {(show.writer || show.director || show.notableCast || show.writerAcclaim) && (
          <div className="credits">
            {show.writer && <p><span>Writer</span>{show.writer}</p>}
            {show.writerAcclaim && <p><span>Writer note</span>{show.writerAcclaim}</p>}
            {show.director && <p><span>Director</span>{show.director}</p>}
            {show.notableCast && <p><span>Notable cast</span>{show.notableCast}</p>}
          </div>
        )}
        {viewer?.role === "owner" && !setupMode && (
          <button className="text-button" onClick={() => setEditingPeople(true)}>
            Edit notable people
          </button>
        )}
        {show.synopsis && <p className="synopsis">{show.synopsis}</p>}
        <div className="source-links">
          {show.ticketUrl && <a href={show.ticketUrl} target="_blank" rel="noreferrer">Tickets ↗</a>}
          {show.sourceUrl && <a href={show.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}
        </div>

        <section className="review-section">
          <div className="section-title">
            <h3>Visits &amp; reviews</h3>
            <button className="small-button" disabled={setupMode} onClick={() => setAdding(true)}>
              + Add a visit
            </button>
          </div>
          {setupMode && <p className="muted">Connect Neon to save visits and reviews.</p>}
          {show.reviews.length === 0 && !setupMode && <p className="muted">No one has reviewed this yet.</p>}
          {show.reviews.map((review) => (
            <ReviewBlock
              key={review.id}
              review={review}
              onEdit={() => setEditing(review)}
              onDelete={() => removeReview(review)}
              onChange={(next) => onChange({
                ...show,
                reviews: show.reviews.map((item) => item.id === next.id ? next : item)
              })}
            />
          ))}
        </section>
        {(adding || editing) && (
          <ReviewForm
            show={show}
            viewer={viewer}
            review={editing}
            onCancel={() => { setAdding(false); setEditing(null); }}
            onSaved={() => window.location.reload()}
          />
        )}
        {editingPeople && (
          <PeopleForm show={show} onCancel={() => setEditingPeople(false)} />
        )}
      </aside>
    </div>
  );
}

function PeopleForm({ show, onCancel }: { show: Show; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest(`/api/shows/${show.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          notableCast: form.get("notableCast"),
          writerAcclaim: form.get("writerAcclaim")
        })
      });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save these notes.");
      setBusy(false);
    }
  }
  return (
    <div className="modal-card">
      <form onSubmit={submit}>
        <div className="section-title">
          <h3>Notable people</h3>
          <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
        </div>
        <label>
          Notable cast
          <textarea
            name="notableCast"
            rows={4}
            defaultValue={show.notableCast ?? ""}
            placeholder="Names worth calling out"
          />
        </label>
        <label>
          Award-winning or acclaimed writer
          <textarea
            name="writerAcclaim"
            rows={4}
            defaultValue={show.writerAcclaim ?? ""}
            placeholder="e.g. Pulitzer Prize-winning playwright…"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save people notes"}</button>
      </form>
    </div>
  );
}

function ReviewBlock({
  review,
  onEdit,
  onDelete,
  onChange
}: {
  review: Review;
  onEdit: () => void;
  onDelete: () => void;
  onChange: (review: Review) => void;
}) {
  const [commenting, setCommenting] = useState(false);
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") ?? "");
    await jsonRequest("/api/comments", {
      method: "POST",
      body: JSON.stringify({ reviewId: review.id, body })
    });
    window.location.reload();
  }
  async function removeComment(id: string) {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    await jsonRequest(`/api/comments/${id}`, { method: "DELETE" });
    onChange({ ...review, comments: review.comments.filter((comment) => comment.id !== id) });
  }

  return (
    <article className={`review-block ${review.visibility === "owners" ? "private-review" : ""}`}>
      <div className="review-meta">
        <div>
          <b>{review.authorName}</b>
          <span> saw this {formatDate(review.seenOn)}</span>
        </div>
        <span>{review.visibility === "owners" ? "Private to owners" : "Shared review"}</span>
      </div>
      {review.rating && <div className="rating" aria-label={`${review.rating} out of 5`}>{"●".repeat(review.rating)}{"○".repeat(5 - review.rating)}</div>}
      {review.body && <p>{review.body}</p>}
      <div className="review-actions">
        <button onClick={() => setCommenting(!commenting)}>Comment</button>
        {review.canEdit && <button onClick={onEdit}>Edit</button>}
        {review.canEdit && <button onClick={onDelete}>Delete</button>}
      </div>
      {review.comments.map((comment) => (
        <div className="comment" key={comment.id}>
          <p><b>{comment.authorName}</b> {comment.body}</p>
          {comment.canEdit && (
            <button onClick={() => removeComment(comment.id)}>Delete</button>
          )}
        </div>
      ))}
      {commenting && (
        <form className="comment-form" onSubmit={addComment}>
          <input name="body" required placeholder="Add to the conversation…" />
          <button>Post</button>
        </form>
      )}
    </article>
  );
}

function ReviewForm({
  show,
  viewer,
  review,
  onCancel,
  onSaved
}: {
  show: Show;
  viewer: Profile | null;
  review: Review | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest(review ? `/api/reviews/${review.id}` : "/api/reviews", {
        method: review ? "PATCH" : "POST",
        body: JSON.stringify({
          showId: show.id,
          seenOn: form.get("seenOn"),
          rating: form.get("rating") ? Number(form.get("rating")) : null,
          body: form.get("body"),
          visibility: form.get("visibility")
        })
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this review.");
      setBusy(false);
    }
  }
  return (
    <div className="modal-card">
      <form onSubmit={submit}>
        <div className="section-title">
          <h3>{review ? "Edit your visit" : "Add a visit"}</h3>
          <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
        </div>
        <label>Date seen<input name="seenOn" type="date" required defaultValue={review?.seenOn} /></label>
        <label>
          Rating
          <select name="rating" defaultValue={review?.rating ?? ""}>
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
          </select>
        </label>
        <label>
          Review
          <textarea name="body" rows={5} defaultValue={review?.body} placeholder="What stayed with you?" />
        </label>
        <label>
          Who can see this?
          <select name="visibility" defaultValue={review?.visibility ?? "public"}>
            <option value="public">Everyone invited to Folly</option>
            {viewer?.role === "owner" && <option value="owners">Only Isobel &amp; Zsuzsa</option>}
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
      </form>
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await jsonRequest("/api/invite", {
        method: "PUT",
        body: JSON.stringify({ code: String(form.get("code") ?? "") || undefined })
      });
      setCode(result.code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the invite.");
    }
  }
  return (
    <div className="drawer-backdrop">
      <div className="invite-dialog">
        <button className="drawer-close" onClick={onClose}>×</button>
        <p className="eyebrow">Owner controls</p>
        <h2>Invite reviewers</h2>
        <p>Changing the code invalidates the previous one. Existing accounts keep their access.</p>
        <form onSubmit={generate}>
          <label>
            Choose a code, or leave blank to generate one
            <input name="code" minLength={8} autoComplete="off" />
          </label>
          <button className="primary-button">Set new invite code</button>
        </form>
        {code && (
          <div className="invite-code">
            <span>Share this code privately</span>
            <b>{code}</b>
            <small>It will not be shown again.</small>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
