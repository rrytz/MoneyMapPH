import { createClient } from "@/lib/supabase/server";
import { getPaychecks } from "@/lib/services/paycheck.service";
import { getExpenseCategories } from "@/lib/services/category.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { PaychecksPageClient } from "./paychecks-page-client";

export default async function PaychecksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [paychecks, categories] = await Promise.all([
    getPaychecks(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
  ]);

  return (
    <PaychecksPageClient
      initialPaychecks={paychecks}
      categories={categories}
    />
  );
}
