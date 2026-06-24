import { BaseViewModel } from '@/core/viewmodel/BaseViewModel';
import { UserRepository } from '@/core/repositories/UserRepository';
import { idle, type AsyncState, type User } from '@/core/types';

interface ProfileState {
  profile: AsyncState<User>;
}

/**
 * Example ViewModel demonstrating the MVVM base (spec §2.2). Owns the async
 * lifecycle of fetching the current user's profile from the Model layer.
 */
export class ProfileViewModel extends BaseViewModel<ProfileState> {
  constructor() {
    super({ profile: idle<User>() });
  }

  load(): Promise<User | undefined> {
    return this.runAsync('profile', () => UserRepository.getMe());
  }
}
