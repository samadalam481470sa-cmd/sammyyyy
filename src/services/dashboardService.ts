import { buildDemoSnapshot } from '../data/demoDataset';
import type { DashboardSnapshot } from '../types';

/**
 * Single data-access seam for the dashboard.
 *
 * The UI only ever awaits this function, so swapping the demo dataset for a
 * real endpoint (`await fetch('/api/dashboard')`) or a generated API client
 * requires no component changes.
 */
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return buildDemoSnapshot();
}
