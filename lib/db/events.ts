import {
  createServiceClient,
  createUserContextClient,
} from "@/lib/supabase/server";

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;

  // alert: string; // "none", "at time of event", "* * before" *= 5m, 10m, 15m, 30m, 1h, 2h, 1d, 2d, 1w
  // show_as: string; // "busy", "free"
  // url: string;
  // notes: string;
}
export interface EventData {
  title: string;
  description?: string;
  location: string;
  start_time: string;
  end_time: string;
}

// MARK: Get Single
export async function getUserEvent(
  userId: string,
  email: string,
  eventId: string
): Promise<Event | null> {
  const userClient = createUserContextClient(userId, email);

  const { data, error } = await userClient
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) {
    throw new Error("Failed to fetch event");
  }

  return data || null;
}

// MARK: Get Many
export async function getUserEvents(
  userId: string,
  email: string
): Promise<Event[]> {
  const userClient = createUserContextClient(userId, email);

  const { data, error } = await userClient
    .from("events")
    .select("*")
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error("Failed to fetch events");
  }

  return data || [];
}

// MARK: Get Within Date Range
export async function getUserEventsInDateRange(
  userId: string,
  email: string,
  startDate: string,
  endDate: string
): Promise<Event[]> {
  const supabaseUserClient = createUserContextClient(userId, email);

  // Convert date strings to proper datetime ranges
  const rangeStart = new Date(startDate + "T06:00:00.000Z");
  const isoStart = rangeStart.toISOString();
  const rangeEnd = new Date(endDate + "T06:00:00.000Z");
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  const isoEnd = rangeEnd.toISOString();

  const { data, error } = await supabaseUserClient
    .from("events")
    .select("*")
    .gte("start_time", isoStart)
    .lte("end_time", isoEnd)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error("Failed to fetch events in date range");
  }

  return data || [];
}

// MARK: Create
export async function createUserEvent(
  userId: string,
  email: string,
  eventData: EventData
): Promise<Event> {
  // const userClient = createUserContextClient(userId, email);
  const userClient = createServiceClient();

  const { data, error } = await userClient
    .from("events")
    .insert({ ...eventData, user_id: userId })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to create event");
  }

  return data;
}

// MARK: Update
export async function updateUserEvent(
  userId: string,
  email: string,
  eventId: string,
  updates: Partial<EventData>
): Promise<Event> {
  const userClient = createUserContextClient(userId, email);

  const { data, error } = await userClient
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to update event");
  }

  return data;
}

// MARK: Delete
export async function deleteUserEvent(
  userId: string,
  email: string,
  eventId: string
): Promise<void> {
  const userClient = createUserContextClient(userId, email);

  const { error } = await userClient.from("events").delete().eq("id", eventId);

  if (error) {
    throw new Error("Failed to delete event");
  }
}
