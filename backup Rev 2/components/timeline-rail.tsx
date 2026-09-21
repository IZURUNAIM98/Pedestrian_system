"use client";

import { useEffect, useRef, useState } from "react";
import type { TimelineStage } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

export function TimelineRail({ stages, activeIndex = 0 }: { stages: Array<Omit<TimelineStage, 'name'> & {name:string}>; activeIndex?: number }) {
  const [selected, setSelected] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSelected(Math.max(0, Math.min(stages.length - 1, activeIndex))));
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, stages.length]);

  function select(index: number) {
    const next = (index + stages.length) % stages.length;
    setSelected(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div className="timeline-rail" role="tablist" aria-label="Seven-stage simulation sequence">
        {stages.map((stage, index) => (
          <button
            className="timeline-step"
            key={stage.name}
            ref={(node) => { refs.current[index] = node; }}
            role="tab"
            aria-selected={selected === index}
            aria-controls="timeline-detail"
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); select(index + 1); }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); select(index - 1); }
              if (event.key === "Home") { event.preventDefault(); select(0); }
              if (event.key === "End") { event.preventDefault(); select(stages.length - 1); }
            }}
          >
            <span className="timeline-number" aria-hidden="true">{index + 1}</span>
            <span className="timeline-copy"><strong>{stage.name}</strong><small>{formatTimestamp(stage.timestamp)} MYT</small></span>
          </button>
        ))}
      </div>
      <div id="timeline-detail" className="timeline-detail" role="tabpanel">
        <span className="eyebrow">Stage {selected + 1} of {stages.length}</span>
        <p>{stages[selected].detail}</p>
      </div>
    </div>
  );
}
