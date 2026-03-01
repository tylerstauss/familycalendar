"use client";

import { useState, useEffect, useCallback } from "react";
import { GroceryItem, FoodItem, FoodItemLink, Meal } from "@/lib/types";
import { format, addDays } from "date-fns";

export default function ListsPage() {
  const [tab, setTab] = useState<"food" | "meals" | "shopping">("food");

  return (
    <div className="pb-4">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Lists</h1>
          <div className="bg-gray-100 rounded-xl p-0.5 flex">
            <button
              onClick={() => setTab("food")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === "food" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Food
            </button>
            <button
              onClick={() => setTab("meals")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === "meals" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Meals
            </button>
            <button
              onClick={() => setTab("shopping")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === "shopping" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Shopping
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {tab === "food" ? <FoodTab /> : tab === "meals" ? <MealsTab /> : <ShoppingTab />}
      </div>
    </div>
  );
}

// ── Food Tab ──────────────────────────────────────────

function FoodTab() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/food-items");
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    await fetch("/api/food-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    await fetchItems();
    setSaving(false);
  };

  const startEdit = (item: FoodItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const saveEdit = async (id: string) => {
    const name = editingName.trim();
    if (name) {
      await fetch("/api/food-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      await fetchItems();
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const deleteItem = async (id: string) => {
    await fetch("/api/food-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (expandedId === id) setExpandedId(null);
    fetchItems();
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const addLink = async (itemId: string, link: { store_name: string; url: string; price: string }) => {
    const res = await fetch("/api/food-items/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        food_item_id: itemId,
        store_name: link.store_name,
        url: link.url,
        price: link.price !== "" ? parseFloat(link.price) : null,
      }),
    });
    if (res.ok) {
      const newLink: FoodItemLink = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, links: [...(item.links ?? []), newLink] }
            : item
        )
      );
    }
  };

  const removeLink = async (itemId: string, linkId: string) => {
    await fetch("/api/food-items/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: linkId }),
    });
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, links: (item.links ?? []).filter((l) => l.id !== linkId) }
          : item
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-lg"
          placeholder="Add a food (e.g. Tacos)..."
        />
        <button
          onClick={addItem}
          disabled={!newName.trim() || saving}
          className="px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 font-medium disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🍽️</p>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">No foods yet</h3>
          <p className="text-gray-500">Add foods your family loves to build your meal picker</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) =>
            editingId === item.id ? (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 border border-indigo-200"
              >
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(item.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="flex-1 px-2 py-1 text-lg text-gray-900 bg-transparent outline-none"
                  autoFocus
                />
                <button
                  onClick={() => saveEdit(item.id)}
                  disabled={!editingName.trim()}
                  className="px-3 py-1 text-sm bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-lg text-gray-900">{item.name}</span>
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className={`p-1 transition-colors ${
                      expandedId === item.id ? "text-indigo-500" : "text-gray-300 hover:text-indigo-400"
                    }`}
                    title="Store links"
                  >
                    {/* chain/link icon */}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="text-gray-300 hover:text-indigo-500 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-gray-300 hover:text-red-500 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {expandedId === item.id && (
                  <LinksPanel
                    item={item}
                    onAddLink={addLink}
                    onRemoveLink={removeLink}
                  />
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function LinksPanel({
  item,
  onAddLink,
  onRemoveLink,
}: {
  item: FoodItem;
  onAddLink: (itemId: string, link: { store_name: string; url: string; price: string }) => Promise<void>;
  onRemoveLink: (itemId: string, linkId: string) => Promise<void>;
}) {
  const [storeName, setStoreName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!storeName.trim() || !url.trim()) return;
    setAdding(true);
    await onAddLink(item.id, { store_name: storeName, url, price });
    setStoreName("");
    setUrl("");
    setPrice("");
    setAdding(false);
  };

  const links = item.links ?? [];

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-lg px-2 py-0.5 shrink-0">
                {link.store_name}
              </span>
              {link.price != null && (
                <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-2 py-0.5 shrink-0">
                  ${Number(link.price).toFixed(2)}
                </span>
              )}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs text-indigo-500 hover:text-indigo-700 truncate min-w-0"
              >
                {link.url}
              </a>
              <button
                onClick={() => onRemoveLink(item.id, link.id)}
                className="text-gray-300 hover:text-red-500 shrink-0 p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Store name"
            className="w-28 px-2 py-1.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 min-w-0"
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            step="0.01"
            min="0"
            className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
          />
          <button
            onClick={handleAdd}
            disabled={!storeName.trim() || !url.trim() || adding}
            className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Meals Tab ─────────────────────────────────────────

function MealsTab() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);

  const fetchMeals = useCallback(async () => {
    const res = await fetch("/api/meals");
    if (res.ok) setMeals(await res.json());
  }, []);

  const fetchFoodItems = useCallback(async () => {
    const res = await fetch("/api/food-items");
    if (res.ok) setFoodItems(await res.json());
  }, []);

  useEffect(() => {
    fetchMeals();
    fetchFoodItems();
  }, [fetchMeals, fetchFoodItems]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (meal: Meal) => { setEditing(meal); setModalOpen(true); };

  const deleteMeal = async (id: string) => {
    await fetch("/api/meals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchMeals();
  };

  const saveMeal = async (name: string, foodItemIds: string[]) => {
    if (editing) {
      await fetch("/api/meals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name, food_item_ids: foodItemIds }),
      });
    } else {
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, food_item_ids: foodItemIds }),
      });
    }
    setModalOpen(false);
    fetchMeals();
  };

  const foodMap = new Map(foodItems.map((f) => [f.id, f.name]));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600"
        >
          + Add Meal
        </button>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🍴</p>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">No meals yet</h3>
          <p className="text-gray-500">Create your first meal to start planning</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meals.map((meal) => (
            <div
              key={meal.id}
              className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{meal.name}</p>
                {meal.food_item_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {meal.food_item_ids.map((fid) => (
                      <span
                        key={fid}
                        className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full"
                      >
                        {foodMap.get(fid) ?? fid}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(meal)}
                  className="text-gray-400 hover:text-indigo-500 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteMeal(meal.id)}
                  className="text-gray-300 hover:text-red-500 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <MealModal
          meal={editing}
          foodItems={foodItems}
          onSave={saveMeal}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function MealModal({
  meal,
  foodItems,
  onSave,
  onCancel,
}: {
  meal: Meal | null;
  foodItems: FoodItem[];
  onSave: (name: string, foodItemIds: string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(meal?.name ?? "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(meal?.food_item_ids ?? [])
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), Array.from(selected));
  };

  const filtered = search.trim()
    ? foodItems.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : foodItems;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {meal ? "Edit Meal" : "New Meal"}
          </h2>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
              placeholder="e.g. Taco Night"
              autoFocus
            />
          </div>

          {foodItems.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Food items</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 mb-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                placeholder="Search foods..."
              />
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 px-2 py-2">No matches</p>
                ) : (
                  filtered.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() => toggle(f.id)}
                        className="w-4 h-4 rounded text-indigo-500 border-gray-300 focus:ring-indigo-400"
                      />
                      <span className="text-gray-800">{f.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-xl border border-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shopping Tab ──────────────────────────────────────

function ShoppingTab() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [addingAll, setAddingAll] = useState(false);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/grocery");
    const data: GroceryItem[] = await res.json();
    setItems(data);
    return data;
  }, []);

  const fetchSuggested = useCallback(async (currentItems: GroceryItem[]) => {
    const today = new Date();
    const start = format(today, "yyyy-MM-dd");
    const end = format(addDays(today, 4), "yyyy-MM-dd");

    const [mealRes, mealsRes, foodRes] = await Promise.all([
      fetch(`/api/meal-plans?start=${start}&end=${end}`),
      fetch("/api/meals"),
      fetch("/api/food-items"),
    ]);
    if (!mealRes.ok || !mealsRes.ok || !foodRes.ok) return;

    const [mealPlans, savedMeals, foodItems]: [
      Array<{ food_item_id?: string; food_name?: string }>,
      Meal[],
      FoodItem[]
    ] = await Promise.all([mealRes.json(), mealsRes.json(), foodRes.json()]);

    const mealMap = new Map(savedMeals.map((m) => [m.id, m]));
    const foodMap = new Map(foodItems.map((f) => [f.id, f.name]));
    const existingNames = new Set(currentItems.map((i) => i.name.toLowerCase().trim()));
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const plan of mealPlans) {
      // If plan references a saved meal, expand its food items
      if (plan.food_item_id && mealMap.has(plan.food_item_id)) {
        const meal = mealMap.get(plan.food_item_id)!;
        for (const fid of meal.food_item_ids) {
          const name = foodMap.get(fid);
          if (!name) continue;
          const key = name.toLowerCase().trim();
          if (!seen.has(key) && !existingNames.has(key)) {
            seen.add(key);
            suggestions.push(name);
          }
        }
      } else {
        // Custom text meal — suggest the meal name itself
        const name = plan.food_name ?? "";
        if (!name) continue;
        const key = name.toLowerCase().trim();
        if (!seen.has(key) && !existingNames.has(key)) {
          seen.add(key);
          suggestions.push(name.trim());
        }
      }
    }

    setSuggested(suggestions);
  }, []);

  useEffect(() => {
    fetchItems().then((data) => fetchSuggested(data));
  }, [fetchItems, fetchSuggested]);

  const addItem = async (name?: string) => {
    const itemName = (name ?? newItem).trim();
    if (!itemName) return;
    await fetch("/api/grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: itemName }),
    });
    if (!name) setNewItem("");
    const updated = await fetchItems();
    setSuggested((prev) =>
      prev.filter((s) => s.toLowerCase().trim() !== itemName.toLowerCase().trim())
    );
    return updated;
  };

  const addAllSuggested = async () => {
    if (suggested.length === 0) return;
    setAddingAll(true);
    for (const ing of suggested) {
      await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ing }),
      });
    }
    setSuggested([]);
    await fetchItems();
    setAddingAll(false);
  };

  const toggleItem = async (id: string, checked: boolean) => {
    await fetch("/api/grocery", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checked: !checked }),
    });
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await fetch("/api/grocery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchItems();
  };

  const clearChecked = async () => {
    if (!confirm("Remove all checked items?")) return;
    await fetch("/api/grocery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear_checked: true }),
    });
    fetchItems();
  };

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {checked.length > 0 && (
          <button
            onClick={clearChecked}
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Clear checked ({checked.length})
          </button>
        )}
      </div>

      {/* Suggested from this week's meals */}
      {suggested.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-indigo-800">From upcoming meals</h2>
              <p className="text-xs text-indigo-500 mt-0.5">
                {suggested.length} item{suggested.length !== 1 ? "s" : ""} from the next 5 days
              </p>
            </div>
            <button
              onClick={addAllSuggested}
              disabled={addingAll}
              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white text-xs font-medium rounded-xl transition-colors"
            >
              {addingAll ? "Adding…" : "Add all"}
            </button>
          </div>
          <div className="space-y-1">
            {suggested.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-indigo-100"
              >
                <span className="flex-1 text-sm text-gray-800">{name}</span>
                <button
                  onClick={() => addItem(name)}
                  className="w-6 h-6 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-600 transition-colors shrink-0"
                  title="Add to list"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-lg"
          placeholder="Add item..."
        />
        <button
          onClick={() => addItem()}
          disabled={!newItem.trim()}
          className="px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 font-medium disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* List */}
      {items.length === 0 && suggested.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">&#x1F6D2;</p>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">List is empty</h3>
          <p className="text-gray-500">Add items to your shopping list</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unchecked.length > 0 && (
            <div className="space-y-1">
              {unchecked.map((item) => (
                <GroceryRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </div>
          )}
          {checked.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Checked ({checked.length})</p>
              <div className="space-y-1 opacity-60">
                {checked.map((item) => (
                  <GroceryRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroceryRow({
  item,
  onToggle,
  onDelete,
}: {
  item: GroceryItem;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100">
      <button
        onClick={() => onToggle(item.id, item.checked)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.checked ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {item.checked && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-lg ${item.checked ? "line-through text-gray-400" : "text-gray-900"}`}>
        {item.name}
      </span>
      <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-500 p-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
