import { HomeBracketCards } from "@/components/HomeBracketCards";
import { BracketErrorBoundary } from "@/components/BracketErrorBoundary";

/** Avoid prerender at build time so Convex useQuery runs only when ConvexProvider is available (request-time or client). */
export const dynamic = "force-dynamic";

/**
 * Home page. When League Name and Season are set in Convex, shows all 8
 * tournament bracket cards from the dashboard (read-only). Otherwise minimal landing.
 */
export default function HomePage() {
  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <BracketErrorBoundary>
        <HomeBracketCards />
      </BracketErrorBoundary>
    </div>
  );
}
