/**
 * Only these emails (case-insensitive) can see and access the Dashboard.
 */
export const DASHBOARD_ALLOWED_EMAILS = [
  "kjkisting@gmail.com",
  "bradkujo@gmail.com",
] as const;

export function canAccessDashboard(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return normalized != null && DASHBOARD_ALLOWED_EMAILS.includes(normalized);
}
