/**
 * TypeScript definitions for Bangla Live TV
 */

export interface Channel {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  group: string;
  rawIndex?: number;
  isTSports?: boolean;
  headers?: Record<string, string>;
}
