/**
 * Shared Package - Main Index
 * Exports all shared types, APIs, and utilities
 */

// Types
export * from './types';

// API Client & Repositories
export { default as ApiClient } from './api/client';
export * from './api/repositories/base.repository';
export * from './api/repositories/auth.repository';
export * from './api/repositories/user.repository';
export * from './api/repositories/event.repository';
export * from './api/repositories/sponsor.repository';
export * from './api/repositories/points.repository';
export * from './api/repositories/announcement.repository';
export * from './api/repositories/hall-of-fame.repository';

// MVVM
export * from './mvvm/base-view-model';

// Constants
export * from './constants';
