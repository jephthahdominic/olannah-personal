'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

// Isolation is structural (SDD 6.5). A throw inside a zone, widget or navigation component stops at the nearest
// boundary and swaps in a fallback built from FOUNDATION components only, so the fallback cannot fail for the same
// reason as the content it replaces.
interface Props {
  fallback: (reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  reset = (): void => this.setState({ failed: false });

  render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
