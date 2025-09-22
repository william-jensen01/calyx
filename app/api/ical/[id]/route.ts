import { NextRequest, NextResponse } from "next/server";
import { getUserByUrlToken } from "@/lib/db/users";
import { getUserEvents } from "@/lib/db/events";
import type { Event } from "@/lib/db/events";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = id.replace(/\.ics$/, "");

    // Get user by URL token
    const user = await getUserByUrlToken(cleanId);
    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get user's events
    const events = await getUserEvents(user.id, user.email);

    // Generate iCal content
    const icsContent = generateICalendar(events, user.name);

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(
          user.name
        )}-calendar.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error generating iCal:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

function generateICalendar(events: Event[], userName: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Calyx Calendar//${escapeICalText(userName)}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escapeICalText(`${userName}'s Calendar`),
    "X-WR-CALDESC:" + escapeICalText(`Calendar for ${userName}`),
    "X-WR-TIMEZONE:UTC",
  ];

  events.forEach((event) => {
    const startTime = formatDateForICal(event.start_time);
    const endTime = formatDateForICal(event.end_time);
    const createdTime = formatDateForICal(event.created_at);
    const updatedTime = formatDateForICal(event.updated_at);

    ics.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@calyx.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `CREATED:${createdTime}`,
      `LAST-MODIFIED:${updatedTime}`,
      `SUMMARY:${escapeICalText(event.title)}`,
      `STATUS:CONFIRMED`,
      `TRANSP:OPAQUE`
    );

    if (event.description && event.description.trim()) {
      ics.push(`DESCRIPTION:${escapeICalText(event.description)}`);
    }

    if (event.location && event.location.trim()) {
      ics.push(`LOCATION:${escapeICalText(event.location)}`);
    }

    ics.push("END:VEVENT");
  });

  ics.push("END:VCALENDAR");

  return ics.join("\r\n");
}

function formatDateForICal(dateString: string): string {
  // Convert ISO string to iCal format (YYYYMMDDTHHMMSSZ)
  return (
    new Date(dateString).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  );
}

function escapeICalText(text: string): string {
  if (!text) return "";

  return text
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/;/g, "\\;") // Escape semicolons
    .replace(/,/g, "\\,") // Escape commas
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "") // Remove carriage returns
    .trim();
}

function sanitizeFilename(filename: string): string {
  // Remove or replace characters that are invalid in filenames
  return filename
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .trim();
}
