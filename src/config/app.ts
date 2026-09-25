/**
 * Application-level configuration.
 *
 * Branding, the signed-in user and module metadata are centralised here so a
 * future auth/tenant service can replace these constants without UI changes.
 */

export const APP_CONFIG = {
  companyName: 'Newport Specialty Partners',
  companyShortName: 'Newport',
  productName: 'Acquisition & Strategic Growth CRM',
  confidentialityNotice: 'Confidential — internal acquisition activity',
} as const;

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  title: string;
}

export const CURRENT_USER: CurrentUser = {
  id: 'usr-mary-sbaschnig',
  firstName: 'Mary',
  lastName: 'Sbaschnig',
  initials: 'MS',
  title: 'Managing Director',
};
