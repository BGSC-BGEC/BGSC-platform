import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState } from './ErrorState';
import { RetroTvError } from '../components/RetroTvError';
import { Button } from '../components/Button';
import { Typography } from '../typography/Typography';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  variant?: 'card' | 'retroTv';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary component that displays a fallback UI when a child crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ErrorBoundary] Caught render error:', error.message, errorInfo.componentStack);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.variant === 'retroTv') {
        return (
          <View style={styles.retroContainer}>
            <RetroTvError
              errorCode="500"
              errorMessage="SYS ERROR"
              scale={0.9}
            />
            <View style={styles.retroTextBlock}>
              <Typography variant="h2" color="text" style={styles.title}>
                {this.props.fallbackTitle ?? 'Signal Interrupted'}
              </Typography>
              <Typography variant="bodySmall" color="textMuted" style={styles.message}>
                {this.state.error?.message ?? 'An unexpected display error occurred.'}
              </Typography>
            </View>
            <Button
              label="Reload Screen"
              onPress={this.reset}
              variant="primary"
              size="md"
              leftIcon="refresh"
              style={styles.retryButton}
            />
          </View>
        );
      }

      return (
        <View style={styles.container}>
          <ErrorState
            title={this.props.fallbackTitle ?? 'Screen temporarily unavailable'}
            message={this.state.error?.message ?? 'A minor display error occurred. Tap Retry to reload this screen.'}
            onRetry={this.reset}
            retryLabel="Reload screen"
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  retroContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  retroTextBlock: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    textAlign: 'center',
    maxWidth: 320,
  },
  retryButton: {
    marginTop: 8,
    minWidth: 160,
  },
});
