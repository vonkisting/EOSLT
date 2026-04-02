"use client";

import { useEffect, useId, useRef, useState } from "react";

type ObsConnectionNameComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  savedNames: string[];
  disabled?: boolean;
};

/**
 * Editable connection profile name with a dropdown of saved Convex profiles.
 */
export function ObsConnectionNameCombobox({
  value,
  onChange,
  savedNames,
  disabled = false,
}: ObsConnectionNameComboboxProps) {
  const uid = useId();
  const inputId = `stream-obs-conn-name-${uid}`;
  const listId = `${inputId}-listbox`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const q = value.trim().toLowerCase();
  const filtered = savedNames.filter((n) => !q || n.toLowerCase().includes(q));

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <label htmlFor={inputId} className="text-xs font-medium text-slate-400">
        Connection Name
      </label>
      <div className="mt-1 flex gap-1">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => savedNames.length > 0 && setOpen(true)}
          onClick={() => savedNames.length > 0 && setOpen(true)}
          autoComplete="off"
          placeholder="E.g. Home PC, Venue Laptop"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40 disabled:opacity-60"
        />
        <button
          type="button"
          aria-label="Show Saved Connection Names"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled || savedNames.length === 0}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-white/15 bg-black/40 px-2.5 text-slate-300 transition hover:border-white/25 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-purple-400/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-white/15 bg-[#1a1428] py-1 shadow-xl shadow-black/50"
        >
          {filtered.map((name) => (
            <li key={name} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={name === value.trim()}
                className="w-full px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
