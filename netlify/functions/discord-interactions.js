// netlify/functions/discord-interactions.js
// Set this function's URL as your Discord app's Interactions Endpoint URL
// URL will be: https://yourdomain.netlify.app/.netlify/functions/discord-interactions

import { createClient } from "@supabase/supabase-js";
import { verifyKey } from "discord-interactions";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

// ── Verify Discord signature ──────────────────────────────────────────────────
function verify(event) {
  const signature = event.headers["x-signature-ed25519"];
  const timestamp = event.headers["x-signature-timestamp"];
  if (!signature || !timestamp) return false;
  return verifyKey(
    Buffer.from(event.body),
    signature,
    timestamp,
    DISCORD_PUBLIC_KEY
  );
}

// ── Build select menu component ───────────────────────────────────────────────
function selectMenu(customId, placeholder, options) {
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: customId,
        placeholder,
        options: options.slice(0, 25).map((o) => ({
          label: o.label,
          value: o.value,
          description: o.description || undefined,
        })),
      },
    ],
  };
}

// ── Format final result embed ─────────────────────────────────────────────────
function resultEmbed(product, setName, storeName) {
  const fields = [];

  if (product.barcode) {
    fields.push({ name: "Barcode", value: `\`${product.barcode}\``, inline: true });
  }
  if (product.sku) {
    fields.push({ name: "SKU", value: `\`${product.sku}\``, inline: true });
  }
  if (product.notes) {
    fields.push({ name: "Notes", value: product.notes, inline: false });
  }

  return {
    type: 4,
    data: {
      embeds: [
        {
          title: `${setName} — ${product.product_type}`,
          description: `Store: **${storeName}**`,
          color: 3447003,
          fields,
          footer: { text: "Use /pokemonsku to look up another product" },
        },
      ],
      flags: 64, // ephemeral — only visible to the user who ran the command
    },
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Verify request is from Discord
  if (!verify(event)) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const body = JSON.parse(event.body);

  // Discord ping verification
  if (body.type === 1) {
    return { statusCode: 200, body: JSON.stringify({ type: 1 }) };
  }

  // ── Slash command: /pokemonsku ──────────────────────────────────────────────
  if (body.type === 2 && body.data.name === "pokemonsku") {
    const { data: sets, error } = await supabase
      .from("pokemon_sets")
      .select("id, name")
      .eq("active", true)
      .order("release_date", { ascending: false });

    if (error || !sets?.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          type: 4,
          data: { content: "No sets found. Ask your server admin to add some!", flags: 64 },
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        type: 4,
        data: {
          content: "**Step 1 of 3** — Select a Pokemon set:",
          flags: 64,
          components: [
            selectMenu(
              "select_set",
              "Choose a set...",
              sets.map((s) => ({ label: s.name, value: s.id }))
            ),
          ],
        },
      }),
    };
  }

  // ── Component interactions (dropdowns) ─────────────────────────────────────
  if (body.type === 3) {
    const customId = body.data.custom_id;
    const selected = body.data.values[0];

    // Step 1 → User picked a set, show store dropdown
    if (customId === "select_set") {
      const setId = selected;

      // Get stores that actually have products for this set
      const { data: products } = await supabase
        .from("pokemon_products")
        .select("store_id, pokemon_stores(id, name)")
        .eq("set_id", setId)
        .eq("active", true);

      if (!products?.length) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            type: 7,
            data: { content: "No products found for that set yet.", components: [], flags: 64 },
          }),
        };
      }

      // Deduplicate stores
      const seen = new Set();
      const stores = products
        .map((p) => p.pokemon_stores)
        .filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        statusCode: 200,
        body: JSON.stringify({
          type: 7, // update message
          data: {
            content: `**Step 2 of 3** — Select a store:\n*Set ID: ${setId}*`,
            flags: 64,
            components: [
              selectMenu(
                `select_store__${setId}`,
                "Choose a store...",
                stores.map((s) => ({ label: s.name, value: s.id }))
              ),
            ],
          },
        }),
      };
    }

    // Step 2 → User picked a store, show product dropdown
    if (customId.startsWith("select_store__")) {
      const setId = customId.replace("select_store__", "");
      const storeId = selected;

      const { data: products } = await supabase
        .from("pokemon_products")
        .select("id, product_type, barcode, sku")
        .eq("set_id", setId)
        .eq("store_id", storeId)
        .eq("active", true);

      if (!products?.length) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            type: 7,
            data: { content: "No products found for that store and set combination.", components: [], flags: 64 },
          }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          type: 7,
          data: {
            content: `**Step 3 of 3** — Select a product:`,
            flags: 64,
            components: [
              selectMenu(
                `select_product__${setId}__${storeId}`,
                "Choose a product...",
                products.map((p) => ({
                  label: p.product_type,
                  value: p.id,
                  description: [p.barcode && `Barcode: ${p.barcode}`, p.sku && `SKU: ${p.sku}`]
                    .filter(Boolean)
                    .join(" | ") || undefined,
                }))
              ),
            ],
          },
        }),
      };
    }

    // Step 3 → User picked a product, show final result
    if (customId.startsWith("select_product__")) {
      const [, setId, storeId] = customId.split("__");
      const productId = selected;

      const [{ data: product }, { data: set }, { data: store }] = await Promise.all([
        supabase
          .from("pokemon_products")
          .select("product_type, barcode, sku, notes")
          .eq("id", productId)
          .single(),
        supabase
          .from("pokemon_sets")
          .select("name")
          .eq("id", setId)
          .single(),
        supabase
          .from("pokemon_stores")
          .select("name")
          .eq("id", storeId)
          .single(),
      ]);

      if (!product || !set || !store) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            type: 7,
            data: { content: "Could not find that product. Please try again.", components: [], flags: 64 },
          }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          ...resultEmbed(product, set.name, store.name),
          components: [],
        }),
      };
    }
  }

  return { statusCode: 400, body: "Unknown interaction" };
};
