export type TrackedProduct = {
  id: string;
  name: string;
  image: string;
  searchQuery: string;
  minPrice: number;
  maxPrice: number;
  excludeKeywords?: string[];
};

export const trackedProducts: TrackedProduct[] = [
  {
    id: "ascended-heroes-pc-etb",
    name: "Ascended Heroes Pokemon Centre ETB",
    image: "/tracked-products/ascended-heroes-pc-etb.jpg",
    searchQuery: "Ascended Heroes Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "phantasmal-flames-pc-etb",
    name: "Phantasmal Flames Pokemon Centre ETB",
    image: "/tracked-products/phantasmal-flames-pc-etb.jpg",
    searchQuery: "Phantasmal Flames Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "mega-evolution-pc-etb",
    name: "Mega Evolution Pokemon Centre ETB",
    image: "/tracked-products/mega-evolution-pc-etb.jpg",
    searchQuery: "Mega Evolution Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "white-flare-pc-etb",
    name: "White Flare Pokemon Centre ETB",
    image: "/tracked-products/white-flare-pc-etb.jpg",
    searchQuery: "White Flare Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "black-bolt-pc-etb",
    name: "Black Bolt Pokemon Centre ETB",
    image: "/tracked-products/black-bolt-pc-etb.jpg",
    searchQuery: "Black Bolt Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "destined-rivals-pc-etb",
    name: "Destined Rivals Pokemon Centre ETB",
    image: "/tracked-products/destined-rivals-pc-etb.jpg",
    searchQuery: "Destined Rivals Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "journey-together-pc-etb",
    name: "Journey Together Pokemon Centre ETB",
    image: "/tracked-products/journey-together-pc-etb.jpg",
    searchQuery: "Journey Together Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "prismatic-evolutions-pc-etb",
    name: "Prismatic Evolutions Pokemon Centre ETB",
    image: "/tracked-products/prismatic-evolutions-pc-etb.jpg",
    searchQuery: "Prismatic Evolutions Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 400,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "surging-sparks-pc-etb",
    name: "Surging Sparks Pokemon Centre ETB",
    image: "/tracked-products/surging-sparks-pc-etb.jpg",
    searchQuery: "Surging Sparks Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
  {
    id: "stellar-crown-pc-etb",
    name: "Stellar Crown Pokemon Centre ETB",
    image: "/tracked-products/stellar-crown-pc-etb.jpg",
    searchQuery: "Stellar Crown Pokemon Center Elite Trainer Box sealed",
    minPrice: 40,
    maxPrice: 300,
    excludeKeywords: ["empty", "opened", "damaged", "single pack", "booster pack", "proxy", "case", "bundle", "job lot", "bulk", "psa", "graded"],
  },
];