import { PositionID, Char, SerializableChar } from "./types";

const MIN_VAL = 0;
const MAX_VAL = 0xffffffff; // uint32 max

function randBetween(low: number, high: number): number {
  if (high - low <= 1) return low;
  const range = high - low - 1;
  return low + 1 + Math.floor(Math.random() * range);
}

function biasedChoice(low: number, high: number, bias: string): number {
  if (high - low <= 1) return low;
  const space = high - low;

  switch (bias) {
    case "left": {
      const zoneHigh = low + Math.floor(space / 3);
      return randBetween(low, zoneHigh);
    }
    case "right": {
      const zoneLow = high - Math.floor(space / 3);
      return randBetween(zoneLow, high);
    }
    default:
      return randBetween(low, high);
  }
}

export function generatePositionBetween(
  left: PositionID | null,
  right: PositionID | null,
  site: string,
  counter: number
): PositionID {
  const path: number[] = [];
  let depth = 0;

  const leftPath = left?.path ?? [];
  const rightPath = right?.path ?? [];

  let bias: string;
  if (leftPath.length === 0 && rightPath.length === 0) {
    bias = "middle";
  } else if (leftPath.length === 0) {
    bias = "left";
  } else if (rightPath.length === 0) {
    bias = "right";
  } else {
    bias = "middle";
  }

  while (true) {
    let l = depth < leftPath.length ? leftPath[depth] : MIN_VAL;
    let r = depth < rightPath.length ? rightPath[depth] : MAX_VAL;

    if (r - l > 1) {
      const chosen = biasedChoice(l, r, bias);
      path.push(chosen);
      break;
    }

    path.push(l);
    depth++;
  }

  return { path, site, counter };
}

export function comparePositionID(a: PositionID, b: PositionID): number {
  const minLen = Math.min(a.path.length, b.path.length);

  for (let i = 0; i < minLen; i++) {
    if (a.path[i] < b.path[i]) return -1;
    if (a.path[i] > b.path[i]) return 1;
  }

  if (a.path.length !== b.path.length) {
    return a.path.length - b.path.length;
  }

  if (a.site < b.site) return -1;
  if (a.site > b.site) return 1;

  return a.counter - b.counter;
}

export function positionIdToKey(id: PositionID): string {
  return `${id.site}-${id.counter}`;
}

export class CRDTDocument {
  chars: Char[] = [];
  clock: number = 0;
  seen: Set<string> = new Set();
  siteId: string;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  tick(): number {
    return ++this.clock;
  }

  merge(remoteClock: number): void {
    this.clock = Math.max(this.clock, remoteClock) + 1;
  }

  loadSnapshot(chars: SerializableChar[]): void {
    this.chars = chars.map((c) => ({
      id: { path: c.path, site: c.site, counter: c.counter },
      value: c.val,
      tombstone: c.t,
    }));
    this.normalize();

    // Rebuild seen set and clock
    for (const c of this.chars) {
      this.seen.add(positionIdToKey(c.id));
      if (c.id.counter > this.clock) {
        this.clock = c.id.counter;
      }
    }
  }

  normalize(): void {
    this.chars.sort((a, b) => comparePositionID(a.id, b.id));
  }

  toString(): string {
    return this.chars
      .filter((c) => !c.tombstone)
      .map((c) => c.value)
      .join("");
  }

  insert(char: Char): void {
    this.chars.push(char);
    this.normalize();
  }

  delete(id: PositionID): void {
    for (const c of this.chars) {
      if (
        c.id.site === id.site &&
        c.id.counter === id.counter &&
        c.id.path.length === id.path.length &&
        c.id.path.every((v, i) => v === id.path[i])
      ) {
        c.tombstone = true;
        break;
      }
    }
  }

  applyRemoteInsert(char: Char): boolean {
    const key = positionIdToKey(char.id);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.merge(char.id.counter);
    this.insert(char);
    return true;
  }

  applyRemoteDelete(id: PositionID): boolean {
    const key = positionIdToKey(id);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.merge(id.counter);
    this.delete(id);
    return true;
  }

  // Get visible chars with their indices for cursor positioning
  getVisibleChars(): { char: Char; index: number }[] {
    const result: { char: Char; index: number }[] = [];
    let visibleIndex = 0;
    for (let i = 0; i < this.chars.length; i++) {
      if (!this.chars[i].tombstone) {
        result.push({ char: this.chars[i], index: visibleIndex });
        visibleIndex++;
      }
    }
    return result;
  }

  // Get the char at a visible position
  getCharAtVisibleIndex(visibleIndex: number): Char | null {
    let count = 0;
    for (const c of this.chars) {
      if (!c.tombstone) {
        if (count === visibleIndex) return c;
        count++;
      }
    }
    return null;
  }

  // Get left neighbor at visible position
  getLeftNeighbor(visibleIndex: number): PositionID | null {
    if (visibleIndex <= 0) return null;
    const char = this.getCharAtVisibleIndex(visibleIndex - 1);
    return char?.id ?? null;
  }

  // Get right neighbor at visible position
  getRightNeighbor(visibleIndex: number): PositionID | null {
    const char = this.getCharAtVisibleIndex(visibleIndex);
    return char?.id ?? null;
  }

  // Get visible index of a character by its ID
  getVisibleIndexOf(id: PositionID): number {
    let visibleIndex = 0;
    for (const c of this.chars) {
      if (
        c.id.site === id.site &&
        c.id.counter === id.counter &&
        c.id.path.length === id.path.length &&
        c.id.path.every((v, i) => v === id.path[i])
      ) {
        return visibleIndex;
      }
      if (!c.tombstone) {
        visibleIndex++;
      }
    }
    return -1;
  }
}
