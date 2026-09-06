import { SupabaseClient } from "@supabase/supabase-js";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getReminders(
  supabase: SupabaseClient,
  userId: string,
  options?: { completed?: boolean }
): Promise<Reminder[]> {
  let query = supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (options && options.completed !== undefined) {
    query = query.eq("completed", options.completed);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Reminder[];
}

export async function createReminder(
  supabase: SupabaseClient,
  userId: string,
  reminder: { title: string; due_date: string; notes?: string }
): Promise<Reminder> {
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: userId,
      title: reminder.title,
      due_date: reminder.due_date,
      notes: reminder.notes || null,
      completed: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Reminder;
}

export async function updateReminder(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  reminder: { title?: string; due_date?: string; notes?: string; completed?: boolean }
): Promise<Reminder> {
  const { data, error } = await supabase
    .from("reminders")
    .update({
      ...reminder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Reminder;
}

export async function deleteReminder(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
