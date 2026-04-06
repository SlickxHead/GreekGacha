import { HERO_DATA } from "./heroes.js";
import { PERSEUS, AETHRA } from "./starters.js";

const map = Object.create(null);
for (const h of HERO_DATA) map[h.id] = h;
map[PERSEUS.id] = PERSEUS;
map[AETHRA.id] = AETHRA;

export function getHeroDefById(id) {
  return map[id] ?? null;
}

export function getAllLookupIds() {
  return Object.keys(map);
}
