/**
 * Admin Security Configuration
 * 
 * This file contains the secure admin path configuration.
 * The admin path is obfuscated to prevent URL guessing attacks.
 * 
 * SECURITY NOTES:
 * - Do NOT use predictable paths like /admin, /dashboard, /panel
 * - The path should be non-guessable and configurable
 * - All admin routes must use this configuration
 */

// Secure admin base path - change this to customize your admin URL
// This replaces the default /admin path with a non-guessable alternative
export const ADMIN_BASE_PATH = '/cp-x9A3kL7m';

// All admin route paths - used for route definitions and navigation
export const ADMIN_ROUTES = {
  dashboard: ADMIN_BASE_PATH,
  notifications: `${ADMIN_BASE_PATH}/notifications`,
  announcements: `${ADMIN_BASE_PATH}/announcements`,
  banners: `${ADMIN_BASE_PATH}/banners`,
  coupons: `${ADMIN_BASE_PATH}/coupons`,
  orders: `${ADMIN_BASE_PATH}/orders`,
  pointsSettings: `${ADMIN_BASE_PATH}/points-settings`,
  chats: `${ADMIN_BASE_PATH}/chats`,
  loyaltyLevels: `${ADMIN_BASE_PATH}/loyalty-levels`,
  defaultSettings: `${ADMIN_BASE_PATH}/default-settings`,
  wallet: `${ADMIN_BASE_PATH}/wallet`,
  walletSettings: `${ADMIN_BASE_PATH}/wallet-settings`,
  invoiceTemplates: `${ADMIN_BASE_PATH}/invoice-templates`,
  savedInvoices: `${ADMIN_BASE_PATH}/saved-invoices`,
  financials: `${ADMIN_BASE_PATH}/financials`,
  partialPaymentSettings: `${ADMIN_BASE_PATH}/partial-payment-settings`,
  competitions: `${ADMIN_BASE_PATH}/competitions`,
  productOffers: `${ADMIN_BASE_PATH}/product-offers`,
  offerPurchases: `${ADMIN_BASE_PATH}/offer-purchases`,
  ticketBundles: `${ADMIN_BASE_PATH}/ticket-bundles`,
  marketplace: `${ADMIN_BASE_PATH}/marketplace`,
  shipmentRequests: `${ADMIN_BASE_PATH}/shipment-requests`,
  printerProtection: `${ADMIN_BASE_PATH}/printer-protection`,
} as const;

// Helper to check if a path is an admin path
export const isAdminPath = (path: string): boolean => {
  return path.startsWith(ADMIN_BASE_PATH);
};

// Helper to get the relative admin path (without base)
export const getAdminRelativePath = (fullPath: string): string => {
  if (fullPath.startsWith(ADMIN_BASE_PATH)) {
    return fullPath.slice(ADMIN_BASE_PATH.length) || '/';
  }
  return fullPath;
};
