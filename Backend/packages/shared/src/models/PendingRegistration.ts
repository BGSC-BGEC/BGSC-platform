import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

/**
 * A sign-up waiting on its mailed code. Collection: `pending_registrations`. Owned by the Auth Service.
 *
 * An email + password account does not exist until the address is proven: `POST /auth/register`
 * writes one of these (never a `users` row), and `POST /auth/register/verify` turns it into the
 * account and deletes it. Before this, register created the user on the spot, so an address
 * nobody had proven held its email and username, and could log in, until someone cleaned it up.
 *
 * One row per email (re-registering replaces it with a fresh code). The username is reserved only
 * while the row is live: `expires_at` is both the code's deadline and the TTL that removes the row,
 * so an abandoned sign-up gives its username back by itself.
 */

export interface IPendingRegistration extends Document<string> {
    _id: string;
    email: string;
    username: string;
    full_name: string;
    /** bcrypt, exactly as `users.password_hash` will hold it. Copied over on verify, never re-hashed. */
    password_hash: string;
    /** bcrypt digest of the mailed 6-digit code. Never the code itself. */
    code_hash: string;
    /** Wrong guesses on the current code. A resend inside a live window keeps the count. */
    attempts: number;
    expires_at: Date;
    created_at: Date;
    updated_at: Date;
}

const PendingRegistrationSchema = new Schema<IPendingRegistration>(
    {
        _id: uuidId,
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        username: { type: String, required: true, lowercase: true, trim: true },
        full_name: { type: String, required: true, trim: true },
        password_hash: { type: String, required: true, select: false },
        code_hash: { type: String, required: true, select: false },
        attempts: { type: Number, default: 0 },
        expires_at: { type: Date, required: true },
    },
    timestamps
);

// The username reservation lookup: "is a live row holding this name for another address?"
PendingRegistrationSchema.index({ username: 1 });
PendingRegistrationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration = model<IPendingRegistration>(
    'PendingRegistration',
    PendingRegistrationSchema,
    'pending_registrations'
);
