import { IUser, User } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';

/**
 * Registrations embed a user snapshot read straight from `users`, so a selfcheck needs real rows.
 * Shared by the registration and team selfchecks rather than written twice.
 */
export async function seedUser(fullName: string): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        profile: { full_name: fullName },
    });
}

export async function dropUsers(ids: string[]): Promise<void> {
    await User.deleteMany({ _id: { $in: ids } });
}
