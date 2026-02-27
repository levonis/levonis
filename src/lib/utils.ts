import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return '0';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return '0';
  return numPrice.toLocaleString('en-US');
}

/**
 * Format a number with thousand separators (e.g., 45097 -> 45,097)
 * Works for both display and input formatting
 */
export function formatNumber(value: number | string): string {
  if (value === '' || value === null || value === undefined) return '';
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(numValue)) return '';
  return numValue.toLocaleString('en-US');
}

/**
 * Parse a formatted number string back to a number (e.g., "45,097" -> 45097)
 */
export function parseFormattedNumber(value: string): number {
  if (!value) return 0;
  const parsed = parseFloat(value.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format input value with thousand separators while typing
 * Returns formatted string suitable for display in input
 */
export function formatNumberInput(value: string): string {
  // Remove all non-digit characters except decimal point
  const cleanValue = value.replace(/[^0-9.]/g, '');
  
  // Handle decimal numbers
  const parts = cleanValue.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Format integer part with commas
  const formattedInteger = integerPart ? parseInt(integerPart, 10).toLocaleString('en-US') : '';
  
  // Reconstruct with decimal if present
  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
}
