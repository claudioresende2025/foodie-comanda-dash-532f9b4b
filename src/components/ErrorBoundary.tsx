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
          <div className="max-w-3xl w-full text-center">
            <h2 className="text-xl font-bold mb-2">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground mb-4">A página encontrou um erro inesperado. Recarregue para tentar novamente.</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Button onClick={this.handleReload}>Recarregar</Button>
            </div>

            {/* Em desenvolvimento, mostramos detalhes do erro para diagnóstico */}
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="text-left bg-muted p-4 rounded-lg overflow-auto max-h-64">
                <h3 className="font-medium mb-2">Detalhes do erro (dev)</h3>
                <pre className="text-xs whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
                {this.state.error?.stack && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Ver stack trace</summary>
                    <pre className="text-xs whitespace-pre-wrap mt-2">{this.state.error.stack}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
