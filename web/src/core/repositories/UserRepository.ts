import { apiClient } from '../api/ApiClient'
import type { User } from '../types'

/** Model-layer gateway to the user-service (via the API gateway). */
export const UserRepository = {
  getMe(): Promise<User> {
    return apiClient.get<User>('/users/me')
  },

  updateMe(patch: Partial<User>): Promise<User> {
    return apiClient.patch<User>('/users/me', patch)
  },
}
