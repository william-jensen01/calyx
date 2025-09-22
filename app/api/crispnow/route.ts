import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-tokens/middleware";
import {
  deleteUserEvent,
  createUserEvent,
  getUserEventsInDateRange,
} from "@/lib/db/events";
import { createServiceClient } from "@/lib/supabase/server";
import type { Event, EventData } from "@/lib/db/events";

interface ScheduleShift {
  date: string;
  dayOfWeek: string;
  day: number;
  employeeName: string;
  role: string;
  startTime: string;
  endTime: string;
  startDateTime: string;
  endDateTime: string;
  duration: {
    totalMinutes: number;
    hours: number;
    minutes: number;
    formatted: string;
  };
  weekInfo: string;
  weekNumber: number;
  storeId: string;
  storeName: string;
}

interface EmployeeData {
  employeeName: string;
  roles: string[];
  shifts: ScheduleShift[];
  stores: string[];
  totalHours: number;
  totalShifts: number;
}

interface ScheduleData {
  metadata: {
    totalShifts: number;
    totalEmployees: number;
    dateRange: {
      start: string;
      end: string;
    };
    extractedAt: string;
    employees: string[];
  };
  employeeData: EmployeeData[];
}

interface CreatedEvent {
  id_prefix: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  employeeName: string;
}

interface FailedCreate {
  employeeName?: string;
  shift?: ScheduleShift;
  error: string;
}

interface ProcessedUser {
  employeeName: string;
  userPrefix: string;
  shiftsProcessed: number;
  eventsDeleted: number;
  eventsFailedToDelete: string[];
  eventsCreated: number;
  eventsFailedToCreate: FailedCreate[];
}

// Convert a shift to an Event
function shiftToEvent(shift: ScheduleShift): EventData {
  return {
    title: `${shift.role}`,
    description: `${shift.role} shift at ${shift.storeName}\nDate: ${shift.date} (${shift.dayOfWeek})\nDuration: ${shift.duration.formatted}`,
    location: shift.storeName,
    start_time: shift.startDateTime,
    end_time: shift.endDateTime,
  };
}

function isSameEvent(a: Event, b: EventData): boolean {
  return (
    a.title === b.title &&
    a.start_time === b.start_time &&
    a.end_time === b.end_time &&
    a.location === b.location
  );
}

export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const scheduleData: ScheduleData = await request.json();

      // Validate the schedule data structure
      if (
        !scheduleData.metadata ||
        !scheduleData.metadata.hasOwnProperty("totalShifts") ||
        !scheduleData.metadata.hasOwnProperty("totalEmployees") ||
        !scheduleData.metadata.employees ||
        !scheduleData.metadata.dateRange ||
        !scheduleData.employeeData
      ) {
        return NextResponse.json(
          {
            error: "Invalid schedule data format.",
          },
          { status: 400 }
        );
      }

      const supabase = createServiceClient();
      const { start: startDate, end: endDate } =
        scheduleData.metadata.dateRange;

      const { data: users, error: userError } = await supabase
        .from("users")
        .select("id, email, name")
        .in("name", scheduleData.metadata.employees);

      if (userError) {
        return NextResponse.json(
          { error: "Failed to lookup users", details: userError.message },
          { status: 500 }
        );
      }

      const foundUsers = users || [];
      const usersByName = new Map(
        foundUsers.map((user) => [user.name.toLowerCase().trim(), user])
      );

      // Track results for each user
      const processedUsers: ProcessedUser[] = [];
      const createdEvents: CreatedEvent[] = [];
      const errors: FailedCreate[] = [];

      for (const employeeData of scheduleData.employeeData) {
        const employeeName = employeeData.employeeName;
        const user = usersByName.get(employeeName.toLowerCase().trim());

        if (!user) {
          errors.push({
            employeeName,
            error: "User not found in database",
          });
          continue;
        }

        console.log(
          `Processing ${employeeData.shifts.length} shifts for user ${user.name}`
        );

        // SUPER IMPORTANT
        // date range is not 100% accurate but for our purposes it's good
        // this is because of the discrepancy between local time and UTC

        // Get existing events for this user in the date range
        const eventsToDelete: Event[] = await getUserEventsInDateRange(
          user.id,
          user.email,
          startDate,
          endDate
        );

        // Delete existing events in parallel
        const deleteResults = await Promise.allSettled(
          eventsToDelete.map((event) =>
            deleteUserEvent(user.id, user.email, event.id)
          )
        );
        const successfulDeletes = new Set<string>();
        const failedDeletes: Event[] = [];

        deleteResults.forEach((result, i) => {
          if (result.status === "fulfilled") {
            successfulDeletes.add(eventsToDelete[i].id);
          } else {
            failedDeletes.push(eventsToDelete[i]);
          }
        });

        console.log(
          `Deleted ${successfulDeletes.size}/${eventsToDelete.length} events for ${employeeName}`
        );

        // Create events in parallel
        const createResults = await Promise.allSettled(
          employeeData.shifts.map(async (shift) => {
            const eventData = shiftToEvent(shift);

            // Skip creation if a matching failed-deletion event exists
            const duplicateInFailedDeletes = failedDeletes.some((e) =>
              isSameEvent(e, eventData)
            );
            if (duplicateInFailedDeletes) {
              throw new Error(
                `Skipped creating event to avoid duplicate: ${eventData.title}`
              );
            }

            return createUserEvent(user.id, user.email, eventData);
          })
        );

        let createdCount = 0;
        const createdEventsForUser: CreatedEvent[] = [];
        const failedCreates: FailedCreate[] = [];

        createResults.forEach((result, i) => {
          if (result.status === "fulfilled") {
            createdCount++;
            createdEventsForUser.push({
              id_prefix: result.value.id.substring(0, 8),
              title: result.value.title,
              start_time: result.value.start_time,
              end_time: result.value.end_time,
              location: result.value.location,
              employeeName,
            });
          } else {
            failedCreates.push({
              shift: employeeData.shifts[i],
              error: (result.reason as Error).message,
            });
          }
        });

        processedUsers.push({
          employeeName,
          userPrefix: user.id.substring(0, 8),
          shiftsProcessed: employeeData.shifts.length,
          eventsDeleted: successfulDeletes.size,
          eventsFailedToDelete: failedDeletes.map((e) => e.id),
          eventsCreated: createdCount,
          eventsFailedToCreate: failedCreates,
        });

        createdEvents.push(...createdEventsForUser);
        errors.push(...failedCreates);
      }

      return NextResponse.json({
        success: true,
        summary: {
          dateRange: { startDate, endDate },
          totalShiftsInData: scheduleData.metadata.totalShifts,
          employeesInSchedule: scheduleData.metadata.totalEmployees,
          usersFound: foundUsers.length,
          usersProcessed: processedUsers.length,
          totalEventsCreated: createdEvents.length,
          totalErrors: errors.length,
        },
        processedUsers,
        createdEvents: createdEvents.map((event) => ({
          id_prefix: event.id_prefix,
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          employeeName: event.employeeName,
        })),
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON in request body" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to import schedule",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  },
  { requireScope: "events:write" }
);
