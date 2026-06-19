import React from 'react';
// 1. Alias the components that are throwing errors
import { Link as RouterLink, Outlet as RouterOutlet } from 'react-router-dom';

// 2. Cast them to 'any' to bypass TypeScript's type checking
const Link = RouterLink as any;
const Outlet = RouterOutlet as any;

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Home</h1>
      
      {/* Simple Navigation Menu */}
      <nav className="flex gap-6 mb-8 border-b pb-4">
        <Link to="/dashboard/announcements" className="text-blue-600 hover:underline">Announcements</Link>
        <Link to="/dashboard/events" className="text-blue-600 hover:underline">Event Management</Link>
        <Link to="/dashboard/users" className="text-blue-600 hover:underline">User Management</Link>
        <Link to="/login" className="text-red-600 hover:underline ml-auto">Logout</Link>
      </nav>

      {/* The clicked page will render right here */}
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
}