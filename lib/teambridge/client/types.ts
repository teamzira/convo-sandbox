/**
 * Client configuration options
 */
export interface TBClientConfig {
  /** OAuth2 Client ID for authentication */
  clientId: string;
  /** OAuth2 Client Secret for authentication */
  clientSecret: string;
  /** Base URL for Teambridge API (defaults to production) */
  baseUrl?: string;
  /** Auth0 token endpoint (defaults to Teambridge Auth0) */
  authUrl?: string;
  /** OAuth2 audience (defaults to API base URL) */
  audience?: string;
  /** Signed X-User-Context header value — forwarded to the Open API to act as the requesting user */
  userContext?: string;
}

/**
 * OAuth2 token response from Auth0
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Pagination options for list endpoints
 */
export interface PaginationOptions {
  /** Page number (0-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  size: number;
  totalCount: number;
}

/**
 * Collection (custom data table)
 */
export interface Collection {
  id: string;
  name: string;
  description?: string;
}

/**
 * Field definition within a collection
 */
export interface Field {
  id: string;
  name: string;
  type: string;
  required: boolean;
}

/**
 * Generic record from a collection
 */
export interface DataRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * Shift data
 */
export interface Shift {
  recordId: string;
  startAt: string;
  endAt: string;
  published: boolean;
  userId: string | null;
  locationId: string | null;
  clockIn: string;
  clockOut: string;
  openCount: number;
  bonus: number | null;
  payRate: number;
  hoursWorkedMilliseconds: number;
  hoursScheduledMilliseconds: number;
  billRate: number | null;
  timezone: string;
  billBonus: number | null;
  roles: string[];
  [key: string]: unknown;
}

/**
 * Request to create a shift
 */
export interface CreateShiftRequest {
  jobId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  [key: string]: unknown;
}

/**
 * Shift timestamp (clock in/out)
 */
export interface ShiftTimestamp {
  id: string;
  shiftId: string;
  userId: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Placement (user assignment to a shift)
 */
export interface Placement {
  id: string;
  shiftId: string;
  userId: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Request to create a placement
 */
export interface CreatePlacementRequest {
  shiftId: string;
  userId: string;
  [key: string]: unknown;
}

/**
 * User data
 */
export interface User {
  recordId: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string | null;
  [key: string]: unknown;
}

/**
 * Request to create a user
 */
export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string | null;
  [key: string]: unknown;
}

/**
 * User lookup query
 */
export interface UserLookupQuery {
  email?: string;
  phone?: string;
  [key: string]: string | undefined;
}

/**
 * Job data
 */
export interface Job {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Request to create a job
 */
export interface CreateJobRequest {
  name: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Location data
 */
export interface Location {
  id: string;
  name: string;
  address?: string;
  [key: string]: unknown;
}

/**
 * Timezone data
 */
export interface Timezone {
  id: string;
  name: string;
  offset: string;
}

/**
 * Document upload options
 */
export interface DocumentUploadOptions {
  roles?: string[];
}

/**
 * Uploaded document
 */
export interface Document {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}
