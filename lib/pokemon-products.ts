export type PokemonTrackedProduct = {
  id: string;
  name: string;
  image: string;
  searchQuery: string;
  minPrice?: number;
  maxPrice?: number;
  excludeKeywords?: string[];
};

export const pokemonTrackedProducts: PokemonTrackedProduct[] = [
  {
    id: "pkc-etb",
    name: "PKC ETB",
    image: "/mega-evolution-pkc-etb.jpg",
    searchQuery: "Pokemon Center Elite Trainer Box Mega Evolution",
    minPrice: 60,
    maxPrice: 250,
    excludeKeywords: [
      "empty",
      "opened",
      "open",
      "damaged",
      "single pack",
      "booster pack",
      "case",
      "display stand",
      "proxy",
    ],
  },
  {
    id: "booster-box",
    name: "Booster Box",
    image: "/mega-evolution-booster-box.jpg",
    searchQuery: "Pokemon Mega Evolution Booster Box",
    minPrice: 80,
    maxPrice: 400,
    excludeKeywords: [
      "empty",
      "opened",
      "open",
      "damaged",
      "single pack",
      "booster pack",
      "bundle",
      "proxy",
    ],
  },
  {
    id: "booster-bundle",
    name: "Booster Bundle",
    image: "/mega-evolution-booster-bundle.jpg",
    searchQuery: "Pokemon Mega Evolution Booster Bundle",
    minPrice: 20,
    maxPrice: 120,
    excludeKeywords: [
      "empty",
      "opened",
      "open",
      "damaged",
      "single pack",
      "booster pack",
      "box break",
      "proxy",
    ],
  },
  {
    id: "half-booster-box",
    name: "Half Booster Box",
    image: "/mega-evolution-half-booster-box.jpg",
    searchQuery: "Pokemon Mega Evolution Half Booster Box",
    minPrice: 40,
    maxPrice: 180,
    excludeKeywords: [
      "empty",
      "opened",
      "open",
      "damaged",
      "single pack",
      "booster pack",
      "proxy",
    ],
  },
  {
    id: "standard-etb",
    name: "Standard ETB",
    image: "/mega-evolution-standard-etb.jpg",
    searchQuery: "Pokemon Mega Evolution Elite Trainer Box",
    minPrice: 40,
    maxPrice: 180,
    excludeKeywords: [
      "pokemon center",
      "empty",
      "opened",
      "open",
      "damaged",
      "single pack",
      "booster pack",
      "proxy",
    ],
  },
];