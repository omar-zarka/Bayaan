import React, {Component, ErrorInfo, ReactNode} from 'react';
import {View, Text} from 'react-native';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return {hasError: true};
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View>
          <Text>{i18n.t('home:errorBoundary.message')}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
