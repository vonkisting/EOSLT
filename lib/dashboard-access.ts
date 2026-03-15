/**
 * Only this email (case-insensitive) can see and access the Dashboard.
 */
export const DASHBOARD_ALLOWED_EMAIL = "kjkisting@gmail.com";

export function canAccessDashboard(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return normalized === DASHBOARD_ALLOWED_EMAIL;
}
