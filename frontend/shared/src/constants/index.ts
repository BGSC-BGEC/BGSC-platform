/**
 * App Constants
 * Centralized constants used across the app
 */

export const API_ENDPOINTS = {
  // Replace the messy mashup with this clean variable:
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  TIMEOUT: 10000,
};

export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_KEY: 'accessToken',
  REFRESH_TOKEN_KEY: 'refreshToken',
  USER_KEY: 'user',
  ACCESS_TOKEN_EXPIRY: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const USER_ROLES = {
  GUEST: 'guest',
  USER: 'user',
  MEMBER: 'member',
  CORE: 'core',
  COORDINATOR: 'coordinator',
  FOUNDER: 'founder',
};

export const EVENT_TYPES = {
  SPORTS: 'sports',
  ESPORTS: 'esports',
  CULTURAL: 'cultural',
  TECHNICAL: 'technical',
  OTHER: 'other',
};

export const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  PAST: 'past',
  CANCELLED: 'cancelled',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto',
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Unauthorized. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  GENERIC_ERROR: 'An error occurred. Please try again.',
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful!',
  REGISTER_SUCCESS: 'Account created successfully! Please log in.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  EVENT_REGISTERED: 'Registered for event successfully!',
  EVENT_CANCELLED: 'Event registration cancelled.',
  POINTS_AWARDED: 'Points awarded successfully!',
  PASSWORD_CHANGED: 'Password changed successfully.',
};
