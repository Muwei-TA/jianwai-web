export type Scope = "club" | "members" | "public";
export interface User {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  is_member: boolean;
}
export interface Session {
  user: User | null;
  csrf_token: string;
}
export interface Club {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  member_count: number;
  my_role: "owner" | "member" | null;
  can_invite: boolean;
}
export interface BodyNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: BodyNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}
export interface Document {
  title: string;
  summary: string;
  body: BodyNode;
  club_id: string | null;
  scope: Scope;
  tags: string[];
  feedback_intent: string;
  cover_asset_id: string | null;
}
export interface Draft extends Document {
  id: string;
  revision: number;
  updated_at: string;
}
export interface Post extends Document {
  id: string;
  author: { id: string; display_name: string };
  club: { id: string; name: string; slug: string };
  status: "pending" | "published" | "changes_requested" | "withdrawn";
  created_at: string;
  published_at?: string;
  review_note?: string;
  comment_count: number;
}
export interface Asset {
  id: string;
  url: string;
  mime_type: string;
  width: number;
  height: number;
}
export interface Invitation {
  id: string;
  club_id: string;
  code?: string;
  expires_at: string;
  created_at: string;
  bound_email: string | null;
  status: "active" | "used" | "expired" | "revoked";
}
export interface Comment {
  id: string;
  body: string;
  author: { id: string; display_name: string };
  created_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
}
export const emptyBody: BodyNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
