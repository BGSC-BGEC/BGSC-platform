export interface Session {
  tokenHash: string;
  deviceIp: string;
  deviceUserAgent: string;
  createdAt: string;
  lastUsedAt: string;
  keepMeLoggedIn: string; // Stored as string 'true' or 'false' in Redis Hash
}
