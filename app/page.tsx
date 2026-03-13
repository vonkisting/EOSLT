import { Bracket } from "@/components/bracket/Bracket";
import { build8Bracket } from "@/lib/bracket-data";

/**
 * Home page: 8-player single-elimination pool bracket (for alignment work).
 */
export default function HomePage() {
  const bracketData = build8Bracket(7);

  return (
    <div className="min-h-[80vh] rounded-xl bg-slate-900/60">
      <div className="border-b border-slate-700/80 px-4 py-3">
        <h1 className="text-lg font-semibold text-white">
          8-Player Single Elimination
        </h1>
        <p className="text-sm text-slate-400">
          Pool tournament bracket · Race to 7
        </p>
      </div>
      <Bracket data={bracketData} />
    </div>
  );
}