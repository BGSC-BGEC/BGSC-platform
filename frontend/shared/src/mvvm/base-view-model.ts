/**
 * Base ViewModel Class
 * All ViewModels should extend this class
 * Provides common patterns for state management with Zustand
 */

export interface ViewModelState {
  loading: boolean;
  error: string | null;
}

export abstract class BaseViewModel<T extends ViewModelState> {
  protected abstract getInitialState(): T;

  // This will be implemented by child classes using Zustand or other state management
  protected state: T;

  constructor() {
    this.state = this.getInitialState();
  }

  protected setState(newState: Partial<T>) {
    this.state = { ...this.state, ...newState };
  }

  protected getState(): T {
    return this.state;
  }

  protected setLoading(loading: boolean) {
    this.setState({ loading } as Partial<T>);
  }

  protected setError(error: string | null) {
    this.setState({ error } as Partial<T>);
  }

  protected clearError() {
    this.setError(null);
  }

  // Helper method for async operations with automatic error handling
  protected async executeAsync<R>(
    operation: () => Promise<R>,
    onSuccess?: (result: R) => void
  ): Promise<R | null> {
    try {
      this.setLoading(true);
      this.clearError();
      const result = await operation();
      onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      this.setError(errorMessage);
      console.error(`ViewModel error: ${errorMessage}`, error);
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  abstract dispose(): void;
}
