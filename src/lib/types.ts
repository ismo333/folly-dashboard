export type City = "nyc" | "london";
export type Role = "owner" | "reviewer";
export type ReviewVisibility = "public" | "owners";

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

export type Comment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

export type Review = {
  id: string;
  showId: string;
  seenOn: string;
  rating: number | null;
  body: string;
  visibility: ReviewVisibility;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  comments: Comment[];
};

export type Show = {
  id: string;
  externalKey: string;
  title: string;
  tier: string;
  venue: string | null;
  status: string | null;
  previewsFrom: string | null;
  opening: string | null;
  closing: string | null;
  writer: string | null;
  director: string | null;
  cast: string | null;
  notableCast: string | null;
  writerAcclaim: string | null;
  newWriting: boolean | null;
  synopsis: string | null;
  ticketUrl: string | null;
  sourceUrl: string | null;
  city: City;
  archived: boolean;
  lastVerifiedAt: string | null;
  reviews: Review[];
};

export type RefreshSummary = {
  added: number;
  updated: number;
  archived: number;
  verified: number;
  errors: string[];
  finishedAt: string;
};
