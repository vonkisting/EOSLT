"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";

/**
 * OBS Browser Source (CEF) often needs an explicit html/body size chain; `fixed inset-0` alone can
 * leave a zero-height document so nothing paints. This locks the viewport to the source size.
 */
export function OverlayViewportShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const snap = (el: HTMLElement) => ({
      margin: el.style.margin,
      padding: el.style.padding,
      width: el.style.width,
      height: el.style.height,
      minHeight: el.style.minHeight,
      minWidth: el.style.minWidth,
      overflow: el.style.overflow,
      display: el.style.display,
    });
    const prevHtml = snap(html);
    const prevBody = snap(body);

    const zero = "0";
    html.style.margin = zero;
    html.style.padding = zero;
    html.style.width = "100%";
    html.style.height = "100%";
    html.style.minHeight = "100%";
    html.style.minWidth = "100%";
    html.style.overflow = "hidden";
    html.style.display = "block";

    body.style.margin = zero;
    body.style.padding = zero;
    body.style.width = "100%";
    body.style.height = "100%";
    body.style.minHeight = "100%";
    body.style.minWidth = "100%";
    body.style.overflow = "hidden";
    body.style.display = "block";

    return () => {
      html.style.margin = prevHtml.margin;
      html.style.padding = prevHtml.padding;
      html.style.width = prevHtml.width;
      html.style.height = prevHtml.height;
      html.style.minHeight = prevHtml.minHeight;
      html.style.minWidth = prevHtml.minWidth;
      html.style.overflow = prevHtml.overflow;
      html.style.display = prevHtml.display;
      body.style.margin = prevBody.margin;
      body.style.padding = prevBody.padding;
      body.style.width = prevBody.width;
      body.style.height = prevBody.height;
      body.style.minHeight = prevBody.minHeight;
      body.style.minWidth = prevBody.minWidth;
      body.style.overflow = prevBody.overflow;
      body.style.display = prevBody.display;
    };
  }, []);

  return (
    <div className="box-border m-0 block h-full min-h-full w-full min-w-full p-0">{children}</div>
  );
}
