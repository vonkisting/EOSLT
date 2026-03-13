"use client";

import { useState } from "react";
import "./home-bracket.css";

type Theme = "none" | "light" | "dark" | "dark-trendy";

function Match({
  winner,
  topSeed,
  topName,
  topRace,
  topScore,
  bottomSeed,
  bottomName,
  bottomRace,
  bottomScore,
}: {
  winner: "top" | "bottom";
  topSeed: string;
  topName: string;
  topRace: string;
  topScore: string;
  bottomSeed: string;
  bottomName: string;
  bottomRace: string;
  bottomScore: string;
}) {
  const winnerClass = winner === "top" ? "winner-top" : "winner-bottom";
  return (
    <div className={`match ${winnerClass}`}>
      <div className="match-top team">
        <span className="image" />
        <span className="seed">{topSeed}</span>
        <span className="race">{topRace}</span>
        <span className="name">{topName}</span>
        <span className="score">{topScore}</span>
      </div>
      <div className="match-bottom team">
        <span className="image" />
        <span className="seed">{bottomSeed}</span>
        <span className="race">{bottomRace}</span>
        <span className="name">{bottomName}</span>
        <span className="score">{bottomScore}</span>
      </div>
      <div className="match-lines">
        <div className="line one" />
        <div className="line two" />
      </div>
      <div className="match-lines alt">
        <div className="line one" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [theme, setTheme] = useState<Theme>("dark-trendy");
  const themeClass =
    theme === "none"
      ? "theme-none"
      : theme === "light"
        ? "theme-light"
        : theme === "dark-trendy"
          ? "theme-dark-trendy"
          : "theme-dark";

  return (
    <div className="home-bracket-root">
      <div className={`theme ${themeClass}`}>
        <div className="bracket disable-image">
          <div className="bracket-header">
            <div className="bracket-header-cell">First Round</div>
            <div className="bracket-header-cell">Second Round</div>
            <div className="bracket-header-cell">Third Round</div>
          </div>
          <div className="bracket-columns">
          <div className="column one">
            <Match
              winner="top"
              topSeed="1"
              topName="Player 1"
              topRace="0"
              topScore="0"
              bottomSeed="8"
              bottomName="Player 8"
              bottomRace="0"
              bottomScore="0"
            />
            <Match
              winner="bottom"
              topSeed="4"
              topName="Player 4"
              topRace="0"
              topScore="0"
              bottomSeed="5"
              bottomName="Player 5"
              bottomRace="0"
              bottomScore="0"
            />
            <Match
              winner="top"
              topSeed="2"
              topName="Player 2"
              topRace="0"
              topScore="0"
              bottomSeed="7"
              bottomName="Player 7"
              bottomRace="0"
              bottomScore="0"
            />
            <Match
              winner="top"
              topSeed="3"
              topName="Player 3"
              topRace="0"
              topScore="0"
              bottomSeed="6"
              bottomName="Player 6"
              bottomRace="0"
              bottomScore="0"
            />
          </div>

          <div className="column two">
            <Match
              winner="bottom"
              topSeed="1"
              topName=""
              topRace="0"
              topScore="0"
              bottomSeed="5"
              bottomName=""
              bottomRace="0"
              bottomScore="0"
            />
            <Match
              winner="bottom"
              topSeed="2"
              topName=""
              topRace="0"
              topScore="0"
              bottomSeed="3"
              bottomName=""
              bottomRace="0"
              bottomScore="0"
            />
          </div>

          <div className="column three">
            <Match
              winner="top"
              topSeed="5"
              topName=""
              topRace="0"
              topScore="0"
              bottomSeed="3"
              bottomName=""
              bottomRace="0"
              bottomScore="0"
            />
          </div>
          </div>
        </div>

        <div className="theme-switcher hidden" aria-hidden>
          <h2>Select a theme</h2>
          <button
            id="theme-none"
            type="button"
            onClick={() => setTheme("none")}
          >
            None
          </button>
          <button
            id="theme-light"
            type="button"
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            id="theme-dark"
            type="button"
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
          <button
            id="theme-dark-trendy"
            type="button"
            onClick={() => setTheme("dark-trendy")}
          >
            Dark Trendy
          </button>
        </div>
      </div>
    </div>
  );
}
