export type SubstitutionEventLike = {
  id: string;
  type: string;
  minute: number;
  side: string;
  source?: string;
  notes?: string | null;
};

export type MatchEventDisplay<T extends SubstitutionEventLike> =
  | { kind: "EVENT"; id: string; event: T }
  | { kind: "SUBSTITUTION"; id: string; minute: number; side: string; source?: string; incoming: T; outgoing: T };

const pairKey = (event: SubstitutionEventLike) => {
  const marker = event.notes?.match(/__SUBSTITUTION_PAIR__:[^\s]+/)?.[0];
  return marker ?? `${event.side}|${event.minute}`;
};

export function groupSubstitutionEvents<T extends SubstitutionEventLike>(events: T[]): MatchEventDisplay<T>[] {
  const buckets = new Map<string, { inEvents: Array<{ event: T; index: number }>; outEvents: Array<{ event: T; index: number }> }>();
  events.forEach((event, index) => {
    if (event.type !== "SUBSTITUTION_IN" && event.type !== "SUBSTITUTION_OUT") return;
    const key = pairKey(event);
    const bucket = buckets.get(key) ?? { inEvents: [], outEvents: [] };
    (event.type === "SUBSTITUTION_IN" ? bucket.inEvents : bucket.outEvents).push({ event, index });
    buckets.set(key, bucket);
  });

  const pairedByIndex = new Map<number, MatchEventDisplay<T>>();
  const consumed = new Set<number>();
  for (const bucket of buckets.values()) {
    const count = Math.min(bucket.inEvents.length, bucket.outEvents.length);
    for (let i = 0; i < count; i++) {
      const incoming = bucket.inEvents[i]!;
      const outgoing = bucket.outEvents[i]!;
      const display: MatchEventDisplay<T> = {
        kind: "SUBSTITUTION",
        id: `${incoming.event.id}:${outgoing.event.id}`,
        minute: incoming.event.minute,
        side: incoming.event.side,
        source: incoming.event.source,
        incoming: incoming.event,
        outgoing: outgoing.event
      };
      const firstIndex = Math.min(incoming.index, outgoing.index);
      pairedByIndex.set(firstIndex, display);
      consumed.add(incoming.index);
      consumed.add(outgoing.index);
    }
  }

  const result: MatchEventDisplay<T>[] = [];
  events.forEach((event, index) => {
    const paired = pairedByIndex.get(index);
    if (paired) result.push(paired);
    else if (!consumed.has(index)) result.push({ kind: "EVENT", id: event.id, event });
  });
  return result;
}
