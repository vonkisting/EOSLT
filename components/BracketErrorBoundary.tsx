"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches client errors (e.g. Convex query failures) so the app shows a fallback
 * instead of the generic "Application error: a client-side exception has occurred".
 */
export class BracketErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-xl border border-white/10 bg-[#2A204A]/95 p-6 text-center backdrop-blur-md">
            <p className="text-[--foreground] mb-2">
              Unable to load the bracket. The connection to the server may have failed.
            </p>
            <p className="text-sm text-slate-400 mb-4">
              Check that the app is configured correctly, or try again later.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="rounded-lg border border-white/25 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
