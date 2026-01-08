import React from 'react';
import { Button } from '@/components/ui/button';

type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl text-center">
            <h2 className="text-xl font-bold mb-2">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground mb-4">A página encontrou um erro inesperado. Recarregue para tentar novamente.</p>
            <div className="flex items-center justify-center gap-2">
              <Button onClick={this.handleReload}>Recarregar</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
