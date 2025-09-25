"use client";

import { useState } from "react";

export function CalendarUrl({ url_token }: { url_token: string }) {
  const getBaseUrl = (): string => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    // Fallback for SSR
    return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  };

  const calendarUrl = `${getBaseUrl()}/api/ical/${url_token}.ics`;
  const [copied, setCopied] = useState(false);

  const fallbackCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = calendarUrl;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Fallback: Oops, unable to copy:", err);
      setCopied(false);
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const copyToClipboard = async () => {
    if (!navigator.clipboard) {
      return fallbackCopy();
    }

    try {
      await navigator.clipboard.writeText(calendarUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setCopied(false);
    }
  };

  return (
    <div className="w-full">
      <div className="rounded-lg sm:rounded-xl border-2 border-gray-200 p-4 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold">
            Your Calendar URL
          </h3>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
            <span>Private & Secure</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={calendarUrl}
              readOnly
              className="w-full p-2 bg-white border-2 border-gray-200 rounded-lg sm:rounded-xl font-mono text-xs sm:text-sm text-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button
            onClick={copyToClipboard}
            className={`px-3 py-2 sm:px-6 sm:py-2 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-w-0 ${
              copied
                ? "bg-green-500 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
          >
            <span className="text-sm sm:text-base">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
