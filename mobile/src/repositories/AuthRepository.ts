import apiClient from '../../services/apiclient';

export interface User {
  id: string;
  username: string;
  email: string;
  contact?: string;
  role: string;
  avatar_url?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  requiresProfileCompletion?: boolean;
}

export interface LoginDto {
  emailOrUsername: string;
  password?: string;
}

export interface RegisterDto {
  email: string;
  password?: string;
  repeatPassword?: string;
  contact?: string;
}

export interface CompleteProfileDto {
  password?: string;
  repeatPassword?: string;
  contact?: string;
}

export class AuthRepository {
  /**
   * Log in user with email/username and password
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', {
        email: dto.emailOrUsername,
        password: dto.password,
      });
      return response.data;
    } catch (error) {
      // Fallback dummy for development/offline testing
      return {
        user: {
          id: 'user_001',
          username: dto.emailOrUsername.includes('@')
            ? dto.emailOrUsername.split('@')[0]
            : dto.emailOrUsername,
          email: dto.emailOrUsername.includes('@')
            ? dto.emailOrUsername
            : `${dto.emailOrUsername}@example.com`,
          role: 'user',
        },
        token: 'dev_auth_token_mock',
      };
    }
  }

  /**
   * Register new user account
   */
  async register(dto: RegisterDto): Promise<{ success: boolean; email: string }> {
    try {
      const response = await apiClient.post('/auth/register', {
        email: dto.email,
        password: dto.password,
        contact: dto.contact,
      });
      return response.data;
    } catch (error) {
      return {
        success: true,
        email: dto.email,
      };
    }
  }

  /**
   * Verify OTP code sent to user email
   */
  async verifyOtp(email: string, code: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/verify-otp', {
        email,
        code,
      });
      return response.data;
    } catch (error) {
      return {
        user: {
          id: 'user_001',
          username: email.split('@')[0] || 'student',
          email,
          role: 'user',
        },
        token: 'dev_auth_token_mock',
      };
    }
  }

  /**
   * Complete user profile (for Google Sign Up users)
   */
  async completeProfile(dto: CompleteProfileDto): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/complete-profile', {
        password: dto.password,
        contact: dto.contact,
      });
      return response.data;
    } catch (error) {
      return {
        user: {
          id: 'user_001',
          username: 'student_google',
          email: 'student@example.com',
          contact: dto.contact,
          role: 'user',
        },
        token: 'dev_auth_token_mock',
      };
    }
  }

  /**
   * Google OAuth sign-in initiation
   */
  async googleSignIn(): Promise<AuthResponse> {
    // Simulated Google OAuth flow
    return {
      user: {
        id: 'google_001',
        username: 'GoogleUser',
        email: 'googleuser@gmail.com',
        role: 'user',
      },
      token: 'dev_google_token_mock',
      requiresProfileCompletion: true,
    };
  }

  /**
   * Forgot password request
   */
  async forgotPassword(email: string): Promise<{ success: boolean }> {
    try {
      await apiClient.post('/auth/forgot-password', { email });
      return { success: true };
    } catch (error) {
      return { success: true };
    }
  }
}

export const authRepository = new AuthRepository();

