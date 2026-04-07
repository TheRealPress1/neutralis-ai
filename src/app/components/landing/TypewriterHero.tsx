"use client";

import { useEffect, useState } from "react";

export default function TypewriterHero() {
  const words = ["Prediction Markets", "Event Contracts", "Binary Options"];
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    const speed = isDeleting ? 40 : 70;

    if (!isDeleting && text === current) {
      // Pause at full word
      const pause = setTimeout(() => setIsDeleting(true), 2500);
      return () => clearTimeout(pause);
    }

    if (isDeleting && text === "") {
      setIsDeleting(false);
      setWordIndex((i) => (i + 1) % words.length);
      return;
    }

    const timer = setTimeout(() => {
      setText(
        isDeleting
          ? current.slice(0, text.length - 1)
          : current.slice(0, text.length + 1),
      );
    }, speed);

    return () => clearTimeout(timer);
  }, [text, isDeleting, wordIndex, words]);

  return (
    <span className="inline-flex items-baseline">
      <span>{text}</span>
      <span
        className="ml-0.5 inline-block h-[1em] w-[2px] bg-neon-green/80"
        style={{ animation: "cursor-blink 1s step-end infinite" }}
      />
      <style jsx>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
