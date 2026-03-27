"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#0d0d0f",
    color: "#e8e8e8",
    fontFamily: "'DM Mono', 'Fira Code', monospace",
    padding: "32px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "40px",
    borderBottom: "1px solid #222",
    paddingBottom: "24px",
  },
  badge: {
    background: "#ffcb05",
    color: "#1a1a1a",
    fontWeight: 700,
    fontSize: "11px",
    letterSpacing: "0.1em",
    padding: "4px 10px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  h1: {
    fontSize: "22px",
    fontWeight: 600,
    color: "#fff",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    marginBottom: "32px",
    background: "#111",
    padding: "4px",
    borderRadius: "8px",
    width: "fit-content",
  },
  tab: (active) => ({
    padding: "8px 20px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "inherit",
    fontWeight: 500,
    background: active ? "#ffcb05" : "transparent",
    color: active ? "#1a1a1a" : "#888",
    transition: "all 0.15s",
  }),
  card: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: "10px",
    padding: "24px",
    marginBottom: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: "#666",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    background: "#0d0d0f",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e8e8e8",
    fontSize: "13px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  select: {
    width: "100%",
    background: "#0d0d0f",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e8e8e8",
    fontSize: "13px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  btnPrimary: {
    background: "#ffcb05",
    color: "#1a1a1a",
    border: "none",
    borderRadius: "6px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.02em",
  },
  btnDanger: {
    background: "transparent",
    color: "#ff4444",
    border: "1px solid #331111",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  btnGhost: {
    background: "transparent",
    color: "#888",
    border: "1px solid #222",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: "#555",
    textTransform: "uppercase",
    borderBottom: "1px solid #1e1e1e",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #161616",
    verticalAlign: "middle",
  },
  pill: (active) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    background: active ? "#0a2a0a" : "#2a0a0a",
    color: active ? "#44ff44" : "#ff4444",
  }),
  code: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "12px",
    color: "#ffcb05",
  },
  toast: (type) => ({
    position: "fixed",
    bottom: "24px",
    right: "24px",
    background: type === "error" ? "#2a0a0a" : "#0a2a0a",
    border: `1px solid ${type === "error" ? "#441111" : "#114411"}`,
    color: type === "error" ? "#ff6666" : "#66ff66",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "13px",
    fontFamily: "inherit",
    zIndex: 9999,
    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
  }),
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#fff",
    marginBottom: "16px",
    marginTop: 0,
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 24px",
    color: "#444",
    fontSize: "13px",
  },
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div style={S.toast(type)}>{message}</div>;
}

// ── Products Tab ──────────────────────────────────────────────────────────────
function ProductsTab({ sets, stores, onToast }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSet, setFilterSet] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [form, setForm] = useState({
    set_id: "", store_id: "", product_type: "",
    barcode: "", sku: "", notes: "",
  });
  const [editId, setEditId] = useState(null);

  const productTypes = [
    "ETB", "Booster Box", "Booster Bundle", "Half Booster",
    "3 Pack Blister", "Single Pack", "PKC ETB", "Tin", "Collection Box",
  ];

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("pokemon_products")
      .select("*, pokemon_sets(name), pokemon_stores(name)")
      .order("created_at", { ascending: false });
    if (filterSet) q = q.eq("set_id", filterSet);
    if (filterStore) q = q.eq("store_id", filterStore);
    const { data } = await q;
    setProducts(data || []);
    setLoading(false);
  }, [filterSet, filterStore]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const save = async () => {
    if (!form.set_id || !form.store_id || !form.product_type) {
      return onToast("Set, Store and Product Type are required", "error");
    }
    let error;
    if (editId) {
      ({ error } = await supabase.from("pokemon_products").update({ ...form }).eq("id", editId));
    } else {
      ({ error } = await supabase.from("pokemon_products").insert([{ ...form, active: true }]));
    }
    if (error) return onToast(error.message, "error");
    onToast(editId ? "Product updated" : "Product added", "success");
    setForm({ set_id: "", store_id: "", product_type: "", barcode: "", sku: "", notes: "" });
    setEditId(null);
    fetchProducts();
  };

  const toggleActive = async (id, current) => {
    await supabase.from("pokemon_products").update({ active: !current }).eq("id", id);
    fetchProducts();
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({
      set_id: p.set_id, store_id: p.store_id, product_type: p.product_type,
      barcode: p.barcode || "", sku: p.sku || "", notes: p.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ set_id: "", store_id: "", product_type: "", barcode: "", sku: "", notes: "" });
  };

  return (
    <div>
      <div style={S.card}>
        <p style={S.sectionTitle}>{editId ? "✏️ Edit Product" : "➕ Add Product"}</p>
        <div style={S.grid}>
          <div>
            <label style={S.label}>Set</label>
            <select style={S.select} value={form.set_id} onChange={e => setForm(f => ({ ...f, set_id: e.target.value }))}>
              <option value="">Select set...</option>
              {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Store</label>
            <select style={S.select} value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}>
              <option value="">Select store...</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Product Type</label>
            <select style={S.select} value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))}>
              <option value="">Select type...</option>
              {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Barcode</label>
            <input style={S.input} value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="e.g. 0123456789012" />
          </div>
          <div>
            <label style={S.label}>SKU</label>
            <input style={S.input} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. 8028493" />
          </div>
          <div>
            <label style={S.label}>Notes</label>
            <input style={S.input} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Goes live after 3am" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={S.btnPrimary} onClick={save}>{editId ? "Save Changes" : "Add Product"}</button>
          {editId && <button style={S.btnGhost} onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <select style={{ ...S.select, width: "200px" }} value={filterSet} onChange={e => setFilterSet(e.target.value)}>
          <option value="">All Sets</option>
          {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select style={{ ...S.select, width: "200px" }} value={filterStore} onChange={e => setFilterStore(e.target.value)}>
          <option value="">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={S.emptyState}>Loading...</div>
        ) : products.length === 0 ? (
          <div style={S.emptyState}>No products yet. Add one above.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Set</th>
                <th style={S.th}>Store</th>
                <th style={S.th}>Product</th>
                <th style={S.th}>Barcode</th>
                <th style={S.th}>SKU</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>{p.pokemon_sets?.name}</td>
                  <td style={S.td}>{p.pokemon_stores?.name}</td>
                  <td style={S.td}>{p.product_type}</td>
                  <td style={S.td}>{p.barcode ? <span style={S.code}>{p.barcode}</span> : <span style={{ color: "#444" }}>—</span>}</td>
                  <td style={S.td}>{p.sku ? <span style={S.code}>{p.sku}</span> : <span style={{ color: "#444" }}>—</span>}</td>
                  <td style={S.td}><span style={S.pill(p.active)}>{p.active ? "Active" : "Hidden"}</span></td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={S.btnGhost} onClick={() => startEdit(p)}>Edit</button>
                      <button style={S.btnDanger} onClick={() => toggleActive(p.id, p.active)}>
                        {p.active ? "Hide" : "Show"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Sets Tab ──────────────────────────────────────────────────────────────────
function SetsTab({ sets, onRefresh, onToast }) {
  const [form, setForm] = useState({ name: "", slug: "", release_date: "" });

  const save = async () => {
    if (!form.name || !form.slug) return onToast("Name and slug are required", "error");
    const { error } = await supabase.from("pokemon_sets").insert([{ ...form, active: true }]);
    if (error) return onToast(error.message, "error");
    onToast("Set added", "success");
    setForm({ name: "", slug: "", release_date: "" });
    onRefresh();
  };

  const toggle = async (id, current) => {
    await supabase.from("pokemon_sets").update({ active: !current }).eq("id", id);
    onRefresh();
  };

  return (
    <div>
      <div style={S.card}>
        <p style={S.sectionTitle}>➕ Add Set</p>
        <div style={S.grid}>
          <div>
            <label style={S.label}>Set Name</label>
            <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Perfect Order" />
          </div>
          <div>
            <label style={S.label}>Slug</label>
            <input style={S.input} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="e.g. perfect-order" />
          </div>
          <div>
            <label style={S.label}>Release Date</label>
            <input style={{ ...S.input, colorScheme: "dark" }} type="date" value={form.release_date} onChange={e => setForm(f => ({ ...f, release_date: e.target.value }))} />
          </div>
        </div>
        <button style={S.btnPrimary} onClick={save}>Add Set</button>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Name</th>
              <th style={S.th}>Slug</th>
              <th style={S.th}>Release Date</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sets.map(s => (
              <tr key={s.id}>
                <td style={S.td}>{s.name}</td>
                <td style={S.td}><span style={S.code}>{s.slug}</span></td>
                <td style={S.td}>{s.release_date || "—"}</td>
                <td style={S.td}><span style={S.pill(s.active)}>{s.active ? "Active" : "Hidden"}</span></td>
                <td style={S.td}>
                  <button style={S.btnDanger} onClick={() => toggle(s.id, s.active)}>
                    {s.active ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Stores Tab ────────────────────────────────────────────────────────────────
function StoresTab({ stores, onRefresh, onToast }) {
  const [name, setName] = useState("");

  const save = async () => {
    if (!name) return onToast("Store name is required", "error");
    const { error } = await supabase.from("pokemon_stores").insert([{ name, active: true }]);
    if (error) return onToast(error.message, "error");
    onToast("Store added", "success");
    setName("");
    onRefresh();
  };

  const toggle = async (id, current) => {
    await supabase.from("pokemon_stores").update({ active: !current }).eq("id", id);
    onRefresh();
  };

  return (
    <div>
      <div style={S.card}>
        <p style={S.sectionTitle}>➕ Add Store</p>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: 1, maxWidth: "320px" }}>
            <label style={S.label}>Store Name</label>
            <input
              style={S.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Tesco"
              onKeyDown={e => e.key === "Enter" && save()}
            />
          </div>
          <button style={S.btnPrimary} onClick={save}>Add Store</button>
        </div>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Store Name</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map(s => (
              <tr key={s.id}>
                <td style={S.td}>{s.name}</td>
                <td style={S.td}><span style={S.pill(s.active)}>{s.active ? "Active" : "Hidden"}</span></td>
                <td style={S.td}>
                  <button style={S.btnDanger} onClick={() => toggle(s.id, s.active)}>
                    {s.active ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Setup Guide Tab ───────────────────────────────────────────────────────────
function SetupTab() {
  const step = (n, title, desc) => (
    <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
      <div style={{ width: "28px", height: "28px", background: "#ffcb05", color: "#1a1a1a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, color: "#fff", marginBottom: "4px", fontSize: "14px" }}>{title}</div>
        <div style={{ color: "#888", fontSize: "13px", lineHeight: "1.6" }}>{desc}</div>
      </div>
    </div>
  );

  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>🚀 Discord Bot Setup Guide</p>
      {step(1, "Create a Discord Application", <>Go to <span style={S.code}>discord.com/developers/applications</span> → New Application → Bot tab → create bot → copy the Bot Token</>)}
      {step(2, "Add Environment Variables to Netlify", <>In Netlify → Site Settings → Environment Variables add:<br /><br />
        <span style={S.code}>DISCORD_APP_ID</span> — from General Information<br />
        <span style={S.code}>DISCORD_PUBLIC_KEY</span> — from General Information<br />
        <span style={S.code}>DISCORD_BOT_TOKEN</span> — from Bot tab<br />
        <span style={S.code}>SUPABASE_URL</span> — from Supabase project settings<br />
        <span style={S.code}>SUPABASE_ANON_KEY</span> — from Supabase project settings
      </>)}
      {step(3, "Install Dependencies", <>Run in your project: <span style={S.code}>npm install discord-interactions</span></>)}
      {step(4, "Deploy Functions", <>Place <span style={S.code}>discord-interactions.js</span> and <span style={S.code}>register-commands.js</span> in your <span style={S.code}>netlify/functions/</span> folder and push to deploy.</>)}
      {step(5, "Set Interactions Endpoint URL", <>In Discord Developer Portal → your app → General Information → Interactions Endpoint URL set it to:<br /><span style={S.code}>https://yourdomain.netlify.app/.netlify/functions/discord-interactions</span></>)}
      {step(6, "Register the Slash Command", <>Visit <span style={S.code}>https://yourdomain.netlify.app/.netlify/functions/register-commands</span> once in your browser.</>)}
      {step(7, "Invite the Bot", <>Discord Developer Portal → OAuth2 → URL Generator → select <span style={S.code}>bot</span> + <span style={S.code}>applications.commands</span> → copy URL → invite to your server.</>)}
      {step(8, "You're Live!", <>Members can now type <span style={S.code}>/pokemonsku</span> in your server.</>)}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PokemonSKU() {
  const [tab, setTab] = useState("products");
  const [sets, setSets] = useState([]);
  const [stores, setStores] = useState([]);
  const [toast, setToast] = useState(null);

  const fetchMeta = useCallback(async () => {
    const [{ data: s }, { data: st }] = await Promise.all([
      supabase.from("pokemon_sets").select("*").order("release_date", { ascending: false }),
      supabase.from("pokemon_stores").select("*").order("name"),
    ]);
    setSets(s || []);
    setStores(st || []);
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const onToast = (message, type) => setToast({ message, type });

  return (
    <div style={S.page}>
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div style={S.header}>
        <span style={S.badge}>Bot</span>
        <h1 style={S.h1}>Pokemon SKU Manager</h1>
        <span style={{ color: "#444", fontSize: "13px", marginLeft: "auto" }}>/pokemonsku Discord command</span>
      </div>

      <div style={S.tabs}>
        {[["products", "Products"], ["sets", "Sets"], ["stores", "Stores"], ["setup", "Setup Guide"]].map(([key, label]) => (
          <button key={key} style={S.tab(tab === key)} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "products" && <ProductsTab sets={sets} stores={stores} onToast={onToast} />}
      {tab === "sets" && <SetsTab sets={sets} onRefresh={fetchMeta} onToast={onToast} />}
      {tab === "stores" && <StoresTab stores={stores} onRefresh={fetchMeta} onToast={onToast} />}
      {tab === "setup" && <SetupTab />}
    </div>
  );
}
