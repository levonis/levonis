/**
 * Safe Excel/CSV export utility
 * Replaces vulnerable xlsx package with native browser APIs
 */

interface ExportOptions {
  filename: string;
  sheetName?: string;
}

/**
 * Escapes a value for CSV format
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Converts data array to CSV string with proper encoding for Arabic
 */
function jsonToCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(escapeCSVValue).join(',');
  
  const rows = data.map(row => 
    headers.map(header => escapeCSVValue(row[header])).join(',')
  );
  
  return [headerRow, ...rows].join('\r\n');
}

/**
 * Downloads a file with proper encoding for Arabic text
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  // Add BOM for proper UTF-8 encoding in Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to CSV file (Excel compatible with UTF-8 BOM)
 */
export function exportToExcel(data: Record<string, any>[], options: ExportOptions): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }
  
  const csvContent = jsonToCSV(data);
  // Use .csv extension but Excel will open it correctly with BOM
  const filename = options.filename.replace(/\.xlsx?$/i, '.csv');
  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Creates export data array from records (helper for common pattern)
 */
export function createExportData<T extends Record<string, any>>(
  records: T[],
  mapper: (record: T, index: number) => Record<string, any>
): Record<string, any>[] {
  return records.map((record, index) => mapper(record, index));
}
