import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- CSV HELPER FUNCTIONS ---

export const parseCSV = (text: string) => {
  const lines = text.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  // Get headers (normalized to lowercase for easier matching)
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  return lines.slice(1).map((line) => {
    // Handle commas inside quotes
    const values: string[] = [];
    let current = "";
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === "," && !inQuote) {
        values.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, "")); // push last value

    return headers.reduce((obj, header, i) => {
      let val = values[i] || "";
      // Convert numeric strings to numbers
      if (!isNaN(Number(val)) && val !== "") {
        obj[header] = Number(val);
      } else {
        obj[header] = val;
      }
      return obj;
    }, {} as Record<string, any>);
  });
};

export const jsonToCSV = (data: any[]) => {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((obj) =>
    headers
      .map((h) => {
        const val =
          obj[h] === null || obj[h] === undefined ? "" : String(obj[h]);
        // Escape quotes and wrap in quotes if contains comma
        if (val.includes(",") || val.includes('"')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
};
