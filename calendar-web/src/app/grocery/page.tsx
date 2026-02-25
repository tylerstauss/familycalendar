"use client";

import { useState, useEffect } from "react";
import { GroceryItem } from "@/lib/types";

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");

  const fetchItems = async () => {
    const res = await fetch("/api/grocery");
    setItems(await res.json());
  };

  useEffect(() => { fetchItems(); }, []);

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    await fetch("/api/grocery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewItem("");
    fetchItems();
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

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {/* Add item */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-lg"
            placeholder="Add item..."
          />
          <button onClick={addItem} disabled={!newItem.trim()}
            className="px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 font-medium disabled:opacity-50">
            Add
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">&#x1F6D2;</p>
            <h3 className="text-xl font-semibold text-gray-900 mb-1">List is empty</h3>
            <p className="text-gray-500">Add items or import from a recipe</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Unchecked items */}
            {unchecked.length > 0 && (
              <div className="space-y-1">
                {unchecked.map((item) => (
                  <GroceryRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                ))}
              </div>
            )}

            {/* Checked items */}
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
