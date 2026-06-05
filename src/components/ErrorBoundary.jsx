import React from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error);
    console.error('Error info:', errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-black uppercase mb-3 text-black">
              Something went wrong
            </h1>
            
            <p className="text-sm text-[#717171] mb-6">
              We encountered an unexpected error. Please try refreshing the page or coming back later.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-left">
                <p className="text-xs font-mono text-red-700 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={() => window.location.href = '/'}
              className="h-12 w-full px-6 bg-black text-white hover:bg-[#222] transition-colors font-bold uppercase text-sm tracking-widest rounded"
            >
              Back to Home
            </button>

            <button
              onClick={() => window.location.reload()}
              className="h-12 w-full px-6 mt-3 border border-[#E5E5E5] text-black hover:bg-[#F5F5F5] transition-colors font-bold uppercase text-sm tracking-widest rounded"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
