export interface User {
  id: string;
  familyId: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

export interface Family {
  id: string;
  name: string;
  createdAt?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  ical_url?: string;
  hidden?: boolean;
  created_at?: string;
}

export interface FamilyCalendar {
  id: string;
  name: string;
  color: string;
  ical_url: string;
  hidden?: boolean;
  created_at?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string; // ISO datetime (UTC midnight for all-day events)
  end_time: string;   // ISO datetime (UTC midnight exclusive for all-day events)
  location: string;
  notes: string;
  assignee_ids: string[]; // member IDs
  recurrence?: string;    // RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1"
  source?: "local" | "ical" | "meal" | "family-ical";
  color?: string; // for family calendar events
  meal_food_items?: string[]; // food item names for meal events
  created_at?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  created_at?: string;
}

export interface Meal {
  id: string;
  name: string;
  food_item_ids: string[];
  created_at?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  recipe_id?: string;
  created_at?: string;
}

export interface Photo {
  id: string;
  original_name: string;
  created_at?: string;
}

export interface MealPlan {
  id: string;
  date: string;         // YYYY-MM-DD
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food_item_id?: string;
  food_name: string;
  notes: string;
  assignee_ids: string[];
  created_at?: string;
}

// Saturated colors for family calendars
export const FAMILY_CALENDAR_COLORS = [
  "#6366F1", // indigo
  "#0EA5E9", // sky
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EC4899", // pink
  "#8B5CF6", // violet
  "#EF4444", // red
  "#14B8A6", // teal
];

// Soft pastel member colors (Skylight-style)
export const MEMBER_COLORS = [
  "#FECDD3", // rose
  "#E9D5FF", // lavender
  "#CCFBF1", // mint
  "#FED7AA", // peach
  "#BFDBFE", // blue
  "#FDE68A", // yellow
  "#D9F99D", // lime
  "#FBCFE8", // magenta
];

// Even lighter tints for column backgrounds
export const MEMBER_COLUMN_BG = [
  "#FFF1F2", // rose bg
  "#F5F3FF", // lavender bg
  "#F0FDFA", // mint bg
  "#FFF7ED", // peach bg
  "#EFF6FF", // blue bg
  "#FFFBEB", // yellow bg
  "#F7FEE7", // lime bg
  "#FDF2F8", // magenta bg
];

// Dark readable text per pastel
export const MEMBER_TEXT_COLORS = [
  "#9F1239", // rose text
  "#6B21A8", // lavender text
  "#115E59", // mint text
  "#9A3412", // peach text
  "#1E40AF", // blue text
  "#92400E", // yellow text
  "#3F6212", // lime text
  "#9D174D", // magenta text
];

// Helper: get column background for a member color
export function getMemberColumnBg(color: string): string {
  const idx = MEMBER_COLORS.indexOf(color);
  return idx >= 0 ? MEMBER_COLUMN_BG[idx] : "#F9FAFB";
}

// Helper: get dark text color for a member color
export function getMemberTextColor(color: string): string {
  const idx = MEMBER_COLORS.indexOf(color);
  return idx >= 0 ? MEMBER_TEXT_COLORS[idx] : "#374151";
}
