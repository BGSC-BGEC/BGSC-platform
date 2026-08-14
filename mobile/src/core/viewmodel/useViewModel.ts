import { useSyncExternalStore } from 'react';
import type { BaseViewModel } from './BaseViewModel';

/**
 * Binds a ViewModel's observable state into a React component. The component
 * re-renders whenever the ViewModel calls setState.
 */
export function useViewModel<S extends object>(vm: BaseViewModel<S>): S {
  return useSyncExternalStore(vm.subscribe, vm.getState, vm.getState);
}
