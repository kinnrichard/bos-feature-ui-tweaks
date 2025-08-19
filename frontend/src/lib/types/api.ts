// Base API types
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  errors: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
  }>;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

// JSON:API standard types
export interface JsonApiResource<T = Record<string, any>> {
  type: string;
  id: string;
  attributes: T;
  relationships?: Record<string, JsonApiRelationship>;
  links?: Record<string, string>;
  meta?: Record<string, any>;
}

export interface JsonApiRelationship {
  data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null;
  links?: Record<string, string>;
  meta?: Record<string, any>;
}

export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
  meta?: Record<string, any>;
}

export interface JsonApiResponse<T = any> {
  data: T;
  included?: JsonApiResource[];
  links?: Record<string, string>;
  meta?: Record<string, any>;
  errors?: Array<{
    id?: string;
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
    meta?: Record<string, any>;
  }>;
}

// Pagination types
export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface PaginatedResponse<T> extends JsonApiResponse<T[]> {
  meta: PaginationMeta;
  links: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

// Auth types
export interface AuthResponse {
  data: {
    type: 'auth';
    id: string;
    attributes: {
      message: string;
      expires_at: string;
    };
    relationships: {
      user: {
        data: { type: 'users'; id: string };
      };
    };
  };
  included: UserResource[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token?: string;
}

// User types
export interface UserAttributes {
  email: string;
  name: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

export type UserResource = JsonApiResource<UserAttributes>;

// Job types
export interface JobAttributes {
  title: string;
  description?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'critical' | 'very_high' | 'high' | 'normal' | 'low' | 'proactive_followup';
  due_date?: string;
  start_date?: string;
  created_at: string;
  updated_at: string;
  client_name?: string;
  technician_names?: string[];
}

export type JobResource = JsonApiResource<JobAttributes>;

export interface JobCreateRequest {
  title: string;
  description?: string;
  client_id: string;
  priority?: 'critical' | 'very_high' | 'high' | 'normal' | 'low' | 'proactive_followup';
  due_date?: string;
  start_date?: string;
  technician_ids?: string[];
}

export interface JobUpdateRequest {
  title?: string;
  description?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'critical' | 'very_high' | 'high' | 'normal' | 'low' | 'proactive_followup';
  due_on?: string | null;
  due_time?: string | null;
  start_on?: string | null;
  start_time?: string | null;
  technician_ids?: string[];
}

// Task types
export interface TaskAttributes {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at?: string;
  position: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export type TaskResource = JsonApiResource<TaskAttributes>;

export interface TaskCreateRequest {
  title: string;
  description?: string;
  parent_id?: string;
  position?: number;
}

export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  position?: number;
}

export interface TaskReorderRequest {
  task_id: string;
  new_position: number;
  parent_id?: string;
}

// Client types
export interface ClientAttributes {
  name: string;
  code: string;
  status: 'active' | 'inactive';
  address?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export type ClientResource = JsonApiResource<ClientAttributes>;

export interface ClientCreateRequest {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ClientUpdateRequest {
  name?: string;
  code?: string;
  status?: 'active' | 'inactive';
  address?: string;
  phone?: string;
  email?: string;
}

// Device types
export interface DeviceAttributes {
  name: string;
  model?: string;
  serial_number?: string;
  status: 'active' | 'inactive' | 'maintenance';
  location?: string;
  created_at: string;
  updated_at: string;
}

export type DeviceResource = JsonApiResource<DeviceAttributes>;

// Health check response
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  rails_version: string;
  database: 'connected' | 'disconnected';
}
