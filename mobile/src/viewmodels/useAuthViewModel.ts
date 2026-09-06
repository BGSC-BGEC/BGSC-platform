import { useState, useCallback } from 'react';
import { useAuth } from '../../store/auth';

export interface FieldErrors {
  email?: string;
  password?: string;
  repeatPassword?: string;
  contact?: string;
  terms?: string;
  otp?: string;
}

export function useAuthViewModel() {
  const auth = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [contact, setContact] = useState('+91 ');
  const [rememberMe, setRememberMe] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * Validate and submit login
   */
  const handleLogin = async (onSuccess?: () => void) => {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = 'Email or username is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    const success = await auth.login(email.trim(), password);
    if (success) {
      onSuccess?.();
    }
    return success;
  };

  /**
   * Validate and submit registration
   */
  const handleRegister = async (onNavigateToOtp?: (registeredEmail: string) => void) => {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email is required';
    } else if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (password !== repeatPassword) {
      errors.repeatPassword = 'Passwords do not match';
    }

    if (!termsAccepted) {
      errors.terms = 'You must agree to the Terms of Service and Privacy Policy';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    const success = await auth.register(trimmedEmail, password, contact.trim());
    if (success) {
      onNavigateToOtp?.(trimmedEmail);
    }
    return success;
  };

  /**
   * Validate and submit OTP verification
   */
  const handleVerifyOtp = async (targetEmail: string, onSuccess?: () => void) => {
    if (!otpCode || otpCode.length < 4) {
      setFieldErrors({ otp: 'Please enter the complete 4-digit code' });
      return false;
    }

    setFieldErrors({});
    const success = await auth.verifyOtp(targetEmail, otpCode);
    if (success) {
      onSuccess?.();
    }
    return success;
  };

  /**
   * Validate and submit profile completion (Google sign-up)
   */
  const handleCompleteProfile = async (onSuccess?: () => void) => {
    const errors: FieldErrors = {};

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (password !== repeatPassword) {
      errors.repeatPassword = 'Passwords do not match';
    }

    if (!termsAccepted) {
      errors.terms = 'You must agree to the Terms of Service and Privacy Policy';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    const success = await auth.completeProfile(password, contact.trim());
    if (success) {
      onSuccess?.();
    }
    return success;
  };

  /**
   * Google OAuth entry
   */
  const handleGoogleSignIn = async (
    onCompleteRequired?: () => void,
    onSuccess?: () => void
  ) => {
    const res = await auth.googleSignIn();
    if (res.success) {
      if (res.requiresProfileCompletion) {
        onCompleteRequired?.();
      } else {
        onSuccess?.();
      }
    }
  };

  return {
    // State
    email,
    setEmail: (v: string) => {
      setEmail(v);
      clearFieldError('email');
    },
    password,
    setPassword: (v: string) => {
      setPassword(v);
      clearFieldError('password');
    },
    repeatPassword,
    setRepeatPassword: (v: string) => {
      setRepeatPassword(v);
      clearFieldError('repeatPassword');
    },
    contact,
    setContact: (v: string) => {
      setContact(v);
      clearFieldError('contact');
    },
    rememberMe,
    setRememberMe,
    termsAccepted,
    setTermsAccepted: (v: boolean) => {
      setTermsAccepted(v);
      clearFieldError('terms');
    },
    otpCode,
    setOtpCode: (v: string) => {
      setOtpCode(v);
      clearFieldError('otp');
    },
    fieldErrors,
    isLoading: auth.isLoading,
    globalError: auth.error,
    pendingEmail: auth.pendingEmail,

    // Methods
    handleLogin,
    handleRegister,
    handleVerifyOtp,
    handleCompleteProfile,
    handleGoogleSignIn,
    clearError: auth.clearError,
  };
}

