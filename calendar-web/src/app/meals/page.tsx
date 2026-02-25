"use client";

import { useState, useEffect } from "react";
import { Recipe, MealPlan, FamilyMember } from "@/lib/types";
import { format, addDays, startOfWeek } from "date-fns";

export default function MealsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [tab, setTab] = useState<"plan" | "recipes">("plan");
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Current week — useState ensures stable reference across renders
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const fetchMealPlans = async () => {
    const res = await fetch(`/api/meal-plans?start=${weekStartStr}&end=${weekEndStr}`);
    if (res.ok) {
      setMealPlans(await res.json());
    }
  };

  const fetchRecipes = async () => {
    const res = await fetch("/api/recipes");
    if (res.ok) setRecipes(await res.json());
  };

  useEffect(() => {
    fetch("/api/members").then((r) => r.json()).then(setMembers);
    fetchRecipes();
    fetchMealPlans();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addRecipe = async (recipe: { name: string; ingredients: string[]; instructions: string }) => {
    await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });
    fetchRecipes();
  };

  const updateRecipe = async (recipe: { id?: string; name: string; ingredients: string[]; instructions: string }) => {
    await fetch("/api/recipes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });
    fetchRecipes();
    setEditingRecipe(null);
  };

  const deleteRecipe = async (id: string) => {
    if (!confirm("Delete this recipe?")) return;
    await fetch("/api/recipes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchRecipes();
  };

  const assignMeal = async (date: string, mealType: string, recipeName: string, recipeId?: string) => {
    const res = await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, meal_type: mealType, recipe_id: recipeId, recipe_name: recipeName }),
    });
    if (res.ok) {
      await fetchMealPlans();
    }
  };

  const removeMealPlan = async (id: string) => {
    await fetch("/api/meal-plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchMealPlans();
  };

  const addIngredientsToGrocery = async (recipe: Recipe) => {
    for (const ingredient of recipe.ingredients) {
      await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredient, recipe_id: recipe.id }),
      });
    }
    alert(`Added ${recipe.ingredients.length} items to grocery list`);
  };

  return (
    <div className="pb-4">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Meals</h1>
          <div className="bg-gray-100 rounded-xl p-0.5 flex">
            <button onClick={() => setTab("plan")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === "plan" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              Meal Plan
            </button>
            <button onClick={() => setTab("recipes")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === "recipes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              Recipes
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        {tab === "plan" ? (
          <WeeklyMealPlan
            weekDays={weekDays}
            mealPlans={mealPlans}
            recipes={recipes}
            members={members}
            onAssign={assignMeal}
            onRemove={removeMealPlan}
          />
        ) : (
          <RecipeList
            recipes={recipes}
            onAdd={() => setShowAddRecipe(true)}
            onEdit={setEditingRecipe}
            onDelete={deleteRecipe}
            onAddToGrocery={addIngredientsToGrocery}
          />
        )}
      </div>

      {(showAddRecipe || editingRecipe) && (
        <RecipeModal
          recipe={editingRecipe}
          onSave={editingRecipe ? updateRecipe : addRecipe}
          onClose={() => { setShowAddRecipe(false); setEditingRecipe(null); }}
        />
      )}
    </div>
  );
}

// ── Weekly Meal Plan ──────────────────────────────────

function WeeklyMealPlan({ weekDays, mealPlans, recipes, members, onAssign, onRemove }: {
  weekDays: Date[];
  mealPlans: MealPlan[];
  recipes: Recipe[];
  members: FamilyMember[];
  onAssign: (date: string, mealType: string, recipeName: string, recipeId?: string) => void;
  onRemove: (id: string) => void;
}) {
  const mealTypes = ["breakfast", "lunch", "dinner"] as const;

  return (
    <div className="space-y-4">
      {weekDays.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayPlans = mealPlans.filter((p) => p.date === dateStr);

        return (
          <div key={dateStr} className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{format(day, "EEEE, MMM d")}</h3>
            <div className="grid grid-cols-3 gap-3">
              {mealTypes.map((type) => {
                const plan = dayPlans.find((p) => p.meal_type === type);
                return (
                  <div key={type} className="min-h-[60px]">
                    <p className="text-xs text-gray-400 uppercase mb-1">{type}</p>
                    {plan ? (
                      <div className="bg-gray-50 rounded-xl p-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{plan.recipe_name}</span>
                        <button onClick={() => onRemove(plan.id)} className="text-gray-400 hover:text-red-500 text-xs ml-1">
                          &times;
                        </button>
                      </div>
                    ) : (
                      <QuickAssign recipes={recipes} onSelect={(name, id) => onAssign(dateStr, type, name, id)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickAssign({ recipes, onSelect }: {
  recipes: Recipe[];
  onSelect: (name: string, id?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full border border-dashed border-gray-200 rounded-xl p-2 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300">
        + Add meal
      </button>
    );
  }

  return (
    <div className="space-y-1">
      {recipes.slice(0, 5).map((r) => (
        <button key={r.id} onClick={() => { onSelect(r.name, r.id); setOpen(false); }}
          className="block w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-indigo-50 text-gray-700 truncate">
          {r.name}
        </button>
      ))}
      <div className="flex gap-1">
        <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onSelect(custom.trim()); setOpen(false); setCustom(""); } }}
          className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded-lg text-gray-900" placeholder="Custom meal" />
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 px-1">&times;</button>
      </div>
    </div>
  );
}

// ── Recipe List ───────────────────────────────────────

function RecipeList({ recipes, onAdd, onEdit, onDelete, onAddToGrocery }: {
  recipes: Recipe[];
  onAdd: () => void;
  onEdit: (r: Recipe) => void;
  onDelete: (id: string) => void;
  onAddToGrocery: (r: Recipe) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-500">{recipes.length} recipe{recipes.length !== 1 ? "s" : ""}</p>
        <button onClick={onAdd} className="bg-indigo-500 text-white px-4 py-2 rounded-xl hover:bg-indigo-600 font-medium text-sm">
          + Add Recipe
        </button>
      </div>
      {recipes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">&#x1F373;</p>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">No recipes yet</h3>
          <p className="text-gray-500">Add your family&apos;s favorite recipes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.name}</h3>
                  {r.ingredients.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">{r.ingredients.join(", ")}</p>
                  )}
                  {r.instructions && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{r.instructions}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => onAddToGrocery(r)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Add ingredients to grocery list">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                  </button>
                  <button onClick={() => onEdit(r)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recipe Modal ──────────────────────────────────────

function RecipeModal({ recipe, onSave, onClose }: {
  recipe: Recipe | null;
  onSave: (r: { id?: string; name: string; ingredients: string[]; instructions: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(recipe?.name || "");
  const [ingredientsText, setIngredientsText] = useState(recipe?.ingredients.join("\n") || "");
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const ingredients = ingredientsText.split("\n").map((s) => s.trim()).filter(Boolean);
    await onSave({ id: recipe?.id, name: name.trim(), ingredients, instructions });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{recipe ? "Edit Recipe" : "Add Recipe"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              placeholder="e.g. Spaghetti Bolognese" autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients (one per line)</label>
            <textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              rows={5} placeholder="Pasta&#10;Ground beef&#10;Tomato sauce" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              rows={3} placeholder="Optional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50">
              {saving ? "Saving..." : recipe ? "Save Changes" : "Add Recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
