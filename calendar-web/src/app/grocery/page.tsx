"use client";

import { useState, useEffect, useCallback } from "react";
import { GroceryItem, Recipe, MealPlan } from "@/lib/types";
import { format, addDays } from "date-fns";

export default function GroceryPage() {
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

  // Compute suggested ingredients from the next 7 days of meal plans
  const fetchSuggested = useCallback(async (currentItems: GroceryItem[]) => {
    const today = new Date();
    const start = format(today, "yyyy-MM-dd");
    const end = format(addDays(today, 6), "yyyy-MM-dd");

    const [mealRes, recipeRes] = await Promise.all([
      fetch(`/api/meal-plans?start=${start}&end=${end}`),
      fetch("/api/recipes"),
    ]);

    if (!mealRes.ok || !recipeRes.ok) return;

    const mealPlans: MealPlan[] = await mealRes.json();
    const recipes: Recipe[] = await recipeRes.json();

    // Find recipe IDs referenced in this week's meal plans
    const recipeIds = new Set(
      mealPlans.map((m) => m.recipe_id).filter(Boolean) as string[]
    );

    // Collect all ingredients from those recipes
    const allIngredients: string[] = [];
    for (const recipe of recipes) {
      if (recipeIds.has(recipe.id)) {
        allIngredients.push(...recipe.ingredients);
      }
    }

    // Deduplicate (case-insensitive) and filter out what's already on the list
    const existingNames = new Set(
      currentItems.map((i) => i.name.toLowerCase().trim())
    );
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const ing of allIngredients) {
      const key = ing.toLowerCase().trim();
      if (!seen.has(key) && !existingNames.has(key)) {
        seen.add(key);
        filtered.push(ing.trim());
      }
    }

    setSuggested(filtered);
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
    // Remove added item from suggestions
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
    <div className="pb-4">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Lists</h1>
          {checked.length > 0 && (
            <button onClick={clearChecked} className="text-sm text-red-500 hover:text-red-600 font-medium">
              Clear checked ({checked.length})
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* Suggested from this week's meals */}
        {suggested.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-indigo-800">From this week&apos;s meals</h2>
                <p className="text-xs text-indigo-500 mt-0.5">{suggested.length} ingredient{suggested.length !== 1 ? "s" : ""} not yet on your list</p>
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
              {suggested.map((ing) => (
                <div key={ing} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-indigo-100">
                  <span className="flex-1 text-sm text-gray-800">{ing}</span>
                  <button
                    onClick={() => addItem(ing)}
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
          <button onClick={() => addItem()} disabled={!newItem.trim()}
            className="px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 font-medium disabled:opacity-50">
            Add
          </button>
        </div>

        {/* List */}
        {items.length === 0 && suggested.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">&#x1F6D2;</p>
            <h3 className="text-xl font-semibold text-gray-900 mb-1">List is empty</h3>
            <p className="text-gray-500">Add items or import from a recipe</p>
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
    </div>
  );
}

function GroceryRow({ item, onToggle, onDelete }: {
  item: GroceryItem;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100">
      <button onClick={() => onToggle(item.id, item.checked)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.checked ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-gray-400"
        }`}>
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
