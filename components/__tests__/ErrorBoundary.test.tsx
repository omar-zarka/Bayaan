// @ai-generated
// A render throw below the root boundary reached the user as an unstyled line
// of text with no way out, and reached Sentry as nothing. These tests pin both
// halves of the fix: the boundary reports, and the user can retry.

import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import branding from '@/config/branding';
import ErrorBoundary from '../ErrorBoundary';

const mockCaptureException: jest.Mock = jest.fn(() => 'abcdef1234567890');
const mockFlush: jest.Mock = jest.fn(() => Promise.resolve(true));

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  flush: () => mockFlush(),
}));

const noop = () => undefined;

function Boom({throws}: {throws: boolean}) {
  if (throws) throw new Error('kaboom');
  return <Text>recovered</Text>;
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockCaptureException.mockClear();
    mockFlush.mockClear();
    // React logs the caught error, and the boundary logs it too.
    consoleError = jest.spyOn(console, 'error').mockImplementation(noop);
  });

  afterEach(() => consoleError.mockRestore());

  it('reports the error to Sentry with the component stack', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [error, context] = mockCaptureException.mock.calls[0] as [
      Error,
      {
        tags: Record<string, string>;
        contexts: {react: {componentStack?: string}};
      },
    ];
    expect(error.message).toBe('kaboom');
    expect(context.tags.scope).toBe('error-boundary');
    expect(typeof context.contexts.react.componentStack).toBe('string');
    expect(context.contexts.react.componentStack?.length).toBeGreaterThan(0);
  });

  it('flushes the report', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('shows a readable message with the app name', () => {
    const {getByText} = render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    getByText('Something went wrong');
    getByText(
      `${branding.appName} hit an unexpected error on this screen. Your downloads and saved items are safe.`,
    );
  });

  it('recovers on retry when the child stops throwing', () => {
    const {getByTestId, getByText, rerender} = render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    );
    fireEvent.press(getByTestId('app-error-boundary-retry'));

    getByText('recovered');
  });

  it('stops offering a retry after two attempts', () => {
    const {queryByTestId, getByTestId, getByText} = render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    fireEvent.press(getByTestId('app-error-boundary-retry'));
    fireEvent.press(getByTestId('app-error-boundary-retry'));

    expect(queryByTestId('app-error-boundary-retry')).toBeNull();
    getByText(/close the app fully/);
  });

  it('restores the full retry budget after a recovery', () => {
    const {queryByTestId, getByTestId, getByText, rerender} = render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    // Incident 1: one retry throws again, the second one recovers.
    fireEvent.press(getByTestId('app-error-boundary-retry'));
    rerender(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    );
    fireEvent.press(getByTestId('app-error-boundary-retry'));
    getByText('recovered');

    // Incident 2: the retry is offered again.
    rerender(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );
    getByText('Something went wrong');
    expect(queryByTestId('app-error-boundary-retry')).not.toBeNull();
  });

  it('renders its children when nothing throws', () => {
    const {getByText} = render(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    );

    getByText('recovered');
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
