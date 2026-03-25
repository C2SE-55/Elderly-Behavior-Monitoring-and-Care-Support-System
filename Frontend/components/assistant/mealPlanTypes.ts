export type MealPlanMeals = {
  breakfast: string;
  lunch: string;
  dinner: string;
};

export type MealKey = keyof MealPlanMeals;

export type MealPlanDay = {
  date: string;
  meals: MealPlanMeals;
};

export type MealPlanTemplate = {
  id: string;
  name: string;
  created_at: string;
  days: MealPlanDay[];
};

