import { createClient } from "@supabase/supabase-js";
import { verifyKey } from "discord-interactions";

export const runtime = "nodejs";
export const maxDuration = 10;

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const DISCORD_APP_ID = process.env.DISCORD_APP_ID;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

async function verifyRequest(request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) return false;
  try {
    const body = await request.clone().text();
    return await verifyKey(Buffer.from(body), signature, timestamp, DISCORD_PUBLIC_KEY);
  } catch (e) {
    return false;
  }
}

function selectMenu(customId, placeholder, options) {
  return {
    type: 1,
    components: [{
      type: 3,
      custom_id: customId,
      placeholder,
      options: options.slice(0, 25).map((o) => ({
        label: o.label,
        value: o.value,
        description: o.description || undefined,
      })),
    }],
  };
}

function resultEmbed(product, setName, storeName) {
  const fields = [];
  if (product.barcode) fields.push({ name: "Barcode", value: `\`${product.barcode}\``, inline: true });
  if (product.sku) fields.push({ name: "SKU", value: `\`${product.sku}\``, inline: true });
  if (product.notes) fields.push({ name: "Notes", value: product.notes, inline: false });
  return {
    embeds: [{
      title: `${setName} — ${product.product_type}`,
      description: `Store: **${storeName}**`,
      color: 3447003,
      fields,
      footer: { text: "Use /pokemonsku to look up another product" },
    }],
    flags: 64,
  };
}

async function editOriginal(token, data) {
  await fetch(`https://discord.com/api/v10/webhooks/${DISCORD_APP_ID}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  const isValid = await verifyRequest(request);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const supabase = getSupabase();
  const token = body.token;

  // Discord ping
  if (body.type === 1) {
    return json({ type: 1 });
  }

  // Slash command /pokemonsku — defer then edit
  if (body.type === 2 && body.data.name === "pokemonsku") {
    // Fire Supabase query in background after responding
    const responsePromise = json({ type: 5, data: { flags: 64 } });

    // Use waitUntil pattern — query runs after response sent
    const queryPromise = (async () => {
      try {
        const { data: sets } = await supabase
          .from("pokemon_sets")
          .select("id, name")
          .eq("active", true)
          .order("release_date", { ascending: false });

        if (!sets || sets.length === 0) {
          await editOriginal(token, { content: "No sets found. Ask your server admin to add some!" });
          return;
        }

        await editOriginal(token, {
          content: "**Step 1 of 3** — Select a Pokemon set:",
          components: [selectMenu("select_set", "Choose a set...", sets.map((s) => ({ label: s.name, value: s.id })))],
        });
      } catch (err) {
        console.error(err);
        await editOriginal(token, { content: "Something went wrong. Please try again." });
      }
    })();

    await Promise.all([queryPromise]);
    return responsePromise;
  }

  // Component interactions
  if (body.type === 3) {
    const customId = body.data.custom_id;
    const selected = body.data.values[0];

    // Step 1 — set chosen
    if (customId === "select_set") {
      const { data: products } = await supabase
        .from("pokemon_products")
        .select("store_id, pokemon_stores(id, name)")
        .eq("set_id", selected)
        .eq("active", true);

      if (!products || products.length === 0) {
        return json({ type: 7, data: { content: "No products found for that set yet.", components: [], flags: 64 } });
      }

      const seen = new Set();
      const stores = products
        .map((p) => p.pokemon_stores)
        .filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
        .sort((a, b) => a.name.localeCompare(b.name));

      return json({
        type: 7,
        data: {
          content: "**Step 2 of 3** — Select a store:",
          flags: 64,
          components: [selectMenu(`select_store__${selected}`, "Choose a store...", stores.map((s) => ({ label: s.name, value: s.id })))],
        },
      });
    }

    // Step 2 — store chosen
    if (customId.startsWith("select_store__")) {
      const setId = customId.replace("select_store__", "");

      const { data: products } = await supabase
        .from("pokemon_products")
        .select("id, product_type, barcode, sku")
        .eq("set_id", setId)
        .eq("store_id", selected)
        .eq("active", true);

      if (!products || products.length === 0) {
        return json({ type: 7, data: { content: "No products found for that store and set.", components: [], flags: 64 } });
      }

      return json({
        type: 7,
        data: {
          content: "**Step 3 of 3** — Select a product:",
          flags: 64,
          components: [
            selectMenu(
              `select_product__${setId}__${selected}`,
              "Choose a product...",
              products.map((p) => ({
                label: p.product_type,
                value: p.id,
                description: [
                  p.barcode && `Barcode: ${p.barcode}`,
                  p.sku && `SKU: ${p.sku}`,
                ].filter(Boolean).join(" | ") || undefined,
              }))
            ),
          ],
        },
      });
    }

    // Step 3 — product chosen
    if (customId.startsWith("select_product__")) {
      const parts = customId.split("__");
      const setId = parts[1];
      const storeId = parts[2];

      const [{ data: product }, { data: set }, { data: store }] = await Promise.all([
        supabase.from("pokemon_products").select("product_type, barcode, sku, notes").eq("id", selected).single(),
        supabase.from("pokemon_sets").select("name").eq("id", setId).single(),
        supabase.from("pokemon_stores").select("name").eq("id", storeId).single(),
      ]);

      if (!product || !set || !store) {
        return json({ type: 7, data: { content: "Could not find that product. Please try again.", flags: 64 } });
      }

      return json({ type: 7, data: resultEmbed(product, set.name, store.name) });
    }
  }

  return new Response("Unknown interaction", { status: 400 });
}
