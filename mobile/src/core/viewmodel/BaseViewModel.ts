import type { AsyncState } from '../types';

type Listener = () => void;

/**
 * Minimal observable base for ViewModels (MVVM presentation layer) — no MobX.
 *
 * A ViewModel holds plain state, mutates it via `setState`, and notifies
 * subscribers. React binds to it through `useViewModel` (useSyncExternalStore).
 *
 * `runAsync` is a helper that drives one `AsyncState<T>` field of the state
 * through loading → success/error while executing a repository call.
 */
export abstract class BaseViewModel<S extends object> {
  protected state: S;
  private listeners = new Set<Listener>();

  constructor(initialState: S) {
    this.state = initialState;
  }

  getState = (): S => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected setState(partial: Partial<S>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  /**
   * Run an async task, writing its lifecycle into `state[key]` as AsyncState.
   * Returns the resolved data (or undefined on error) for optional chaining.
   */
  protected async runAsync<T>(key: keyof S, task: () => Promise<T>): Promise<T | undefined> {
    this.setState({ [key]: { status: 'loading' } } as Partial<S>);
    try {
      const data = await task();
      this.setState({ [key]: { status: 'success', data } } as Partial<S>);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Something went wrong';
      this.setState({ [key]: { status: 'error', error } } as Partial<S>);
      return undefined;
    }
  }
}

export type { AsyncState };
