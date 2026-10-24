import React, {Component, ErrorInfo, ReactNode} from 'react';
import {Appearance, Pressable, StyleSheet, Text, View} from 'react-native';
// @ai-start
import * as Sentry from '@sentry/react-native';
import i18n from '@/i18n';
import branding from '@/config/branding';
// @ai-end

interface Props {
  children: ReactNode;
}

// @ai-start
interface State {
  hasError: boolean;
  retries: number;
}

// Two retries, then stop offering one. A render throw is usually
// deterministic, so a third attempt only throws again.
const MAX_RETRIES = 2;

/**
 * Text for the error screen, with an English fallback. The screen must render
 * even when the failure came from the i18n or branding layer.
 */
function safeText(read: () => string, fallback: string): string {
  try {
    const value = read();
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    retries: 0,
  };

  public static getDerivedStateFromError(_: Error): Partial<State> {
    return {hasError: true};
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // The boundary catches the error, so no global handler reports it, and
    // console.error is not a Sentry event. Report it here, with the
    // component stack.
    Sentry.captureException(error, {
      tags: {scope: 'error-boundary'},
      contexts: {
        react: {componentStack: errorInfo?.componentStack ?? undefined},
      },
    });
    // The user's next action on this screen is often a force quit. Flush so
    // the report does not race the kill. This runs a few times per process
    // at most.
    Sentry.flush().catch(() => undefined);
  }

  // The retry budget is per incident. When a retry throws again, React
  // renders with hasError: true at once, so an update that sees
  // hasError: false means the children committed without a throw.
  public componentDidUpdate() {
    if (!this.state.hasError && this.state.retries > 0) {
      this.setState({retries: 0});
    }
  }

  private handleRetry = () => {
    this.setState(s => ({hasError: false, retries: s.retries + 1}));
  };

  public render() {
    if (this.state.hasError) {
      const canRetry = this.state.retries < MAX_RETRIES;
      // No theme, safe-area or icon providers here: one of them may be what
      // failed. The colors follow the system scheme, and the top padding
      // keeps the text clear of the status bar.
      const colors =
        Appearance.getColorScheme() === 'dark' ? darkColors : lightColors;
      const retryLabel = safeText(
        () => i18n.t('common:actions.tryAgain'),
        'Try again',
      );

      return (
        <View
          style={[styles.container, {backgroundColor: colors.background}]}
          testID="app-error-boundary">
          <Text style={[styles.title, {color: colors.text}]}>
            {safeText(
              () => i18n.t('common:status.error'),
              'Something went wrong',
            )}
          </Text>
          <Text style={[styles.body, {color: colors.secondary}]}>
            {canRetry
              ? safeText(
                  () =>
                    i18n.t('home:errorBoundary.message', {
                      appName: branding.appName,
                    }),
                  'The app hit an unexpected error on this screen.',
                )
              : safeText(
                  () =>
                    i18n.t('home:errorBoundary.repeat', {
                      appName: branding.appName,
                    }),
                  'The app hit the same error again. Close it fully and open it again.',
                )}
          </Text>
          {canRetry ? (
            <Pressable
              onPress={this.handleRetry}
              style={[styles.button, {backgroundColor: colors.text}]}
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
              testID="app-error-boundary-retry">
              <Text style={[styles.buttonLabel, {color: colors.background}]}>
                {retryLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    return this.props.children;
  }
}

const lightColors = {
  background: '#f4f3ec',
  text: '#1c1c1e',
  secondary: '#5a5a5f',
};

const darkColors = {
  background: '#07121a',
  text: '#f2f2f7',
  secondary: '#a1a1a6',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
// @ai-end

export default ErrorBoundary;
