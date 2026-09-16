"use client";

import { useEffect, useState } from "react";

const phrases = ["Edit less.", "Edit with AI.", "Share faster."];

export function HeroTypewriter() {
  const [phrase, setPhrase] = useState(0);
  const [length, setLength] = useState(phrases[0].length);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const current = phrases[phrase];
    const complete = length === current.length;
    const empty = length === 0;
    const delay = complete && !deleting ? 1200 : deleting ? 45 : 80;
    const timer = window.setTimeout(() => {
      if (complete && !deleting) setDeleting(true);
      else if (empty && deleting) {
        setDeleting(false);
        setPhrase((value) => (value + 1) % phrases.length);
      } else setLength((value) => value + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, length, phrase]);

  return (
    <>
      <span className="sr-only">Record once. Edit less. Edit with AI. Share faster.</span>
      <span aria-hidden="true">
        Record once.
        <br />
        <em className="typewriter">{phrases[phrase].slice(0, length)}</em>
      </span>
    </>
  );
}
