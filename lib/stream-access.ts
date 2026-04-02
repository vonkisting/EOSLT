/**
 * Only this email (case-insensitive) can see and access the Stream page.
 */
const STREAM_ALLOWED_EMAIL = "kjkisting@gmail.com";

export function canAccessStream(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return normalized === STREAM_ALLOWED_EMAIL;
}
