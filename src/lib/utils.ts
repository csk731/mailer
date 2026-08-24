import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function escapeHtml(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) {
        lines.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length === 0) {
    return { headers: ['EMAIL'], rows: [] };
  }

  const rawHeaders = lines[0].map(h => {
    const sanitized = h.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return sanitized || 'COLUMN';
  });
  const headers: string[] = [];
  rawHeaders.forEach(h => {
    let name = h;
    let counter = 1;
    while (headers.some(existing => existing.toUpperCase() === name.toUpperCase())) {
      name = `${h}_${counter++}`;
    }
    headers.push(name);
  });

  if (!headers.includes('EMAIL')) {
    const emailIdx = headers.findIndex(h => h.includes('EMAIL') || h.includes('MAIL'));
    if (emailIdx !== -1) {
      headers[emailIdx] = 'EMAIL';
    } else {
      headers.unshift('EMAIL');
    }
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowObj: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = line[colIdx] || '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

export function exportCsv(headers: string[], rows: Record<string, string>[]): string {
  const headerLine = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(r => 
    headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}
