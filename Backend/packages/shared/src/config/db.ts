import mongoose from 'mongoose';
import { config } from './env';

export async function connectDB(): Promise<void> {
  try {
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected.');
    });

    // autoIndex off: `buildIndexes` builds exactly the models this service owns, awaited and fatal.
    // With it on, every service ALSO background-built all 30+ models' indexes with errors swallowed
    // — the `models:` scoping was only half real (audit #2).
    await mongoose.connect(config.mongoUri, {
      autoIndex: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error('Fatal: Initial MongoDB connection failed:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
}

export function getDBStatus(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}
