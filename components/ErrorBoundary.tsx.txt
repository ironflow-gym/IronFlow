import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level error boundary for IronFlow.
 *
 * Catches unhandled React render errors and replaces the blank white screen
 * that would otherwise appear with a recovery UI consistent with the app's
 * existing recovery mask. Provides two paths:
 *   1. Soft reset — clears the service worker cache and reloads, which
 *      resolves stale-chunk errors after a deployment.
 *   2. Hard reset — clears SW cache + all cached assets, then reloads.
 *      Does NOT touch IndexedDB; workout data is always preserved.
 *
 * The error message is shown collapsed behind a Details toggle so the
 * screen is not alarming for non-technical users while still giving
 * developers the information they need.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for developer visibility — no PII is exposed here
    // because IronFlow renders no user-supplied strings in component trees.
    console.error('[IronFlow] Uncaught render error:', error, info.componentStack);
  }

  private handleSoftReset = () => {
    // Clear SW caches and reload. IndexedDB is untouched.
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    setTimeout(() => window.location.reload(), 300);
  };

  private handleHardReset = () => {
    if (!window.confirm(
      'This will clear the application cache and force a full reload. ' +
      'Your gym records are stored separately and will NOT be affected. Continue?'
    )) return;

    // Unregister service workers, clear all caches, then reload.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    setTimeout(() => window.location.replace(
      window.location.origin + window.location.pathname
    ), 400);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#020617',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: '2rem', padding: '2.5rem', maxWidth: '420px',
          width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}>
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"
              viewBox="0 0 24 24" fill="none" stroke="#ef4444"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
          </div>

          {/* Heading */}
          <h2 style={{
            fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9',
            marginBottom: '0.5rem', letterSpacing: '-0.025em', textAlign: 'center',
          }}>
            Something went wrong
          </h2>
          <p style={{
            color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center',
            marginBottom: '2rem', lineHeight: 1.5,
          }}>
            IronFlow hit an unexpected error. Your workout data is safe.
            Try a soft reset first — if that doesn't work, use the hard reset.
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              onClick={this.handleSoftReset}
              style={{
                width: '100%', background: '#10b981', color: '#020617',
                fontWeight: 800, padding: '0.875rem', borderRadius: '0.875rem',
                border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                letterSpacing: '0.05em', fontSize: '0.75rem',
              }}
            >
              Soft Reset (Recommended)
            </button>
            <button
              onClick={this.handleHardReset}
              style={{
                width: '100%', background: 'transparent',
                color: '#f87171', fontWeight: 700, padding: '0.75rem',
                borderRadius: '0.875rem', border: '1px solid rgba(239,68,68,0.3)',
                cursor: 'pointer', textTransform: 'uppercase',
                letterSpacing: '0.05em', fontSize: '0.75rem',
              }}
            >
              Hard Reset
            </button>
          </div>

          {/* Collapsible error detail — for developers / support */}
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{
              color: '#475569', fontSize: '0.7rem', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700,
              userSelect: 'none',
            }}>
              Error detail
            </summary>
            <pre style={{
              marginTop: '0.75rem', padding: '0.75rem',
              background: '#020617', borderRadius: '0.5rem',
              color: '#94a3b8', fontSize: '0.7rem', overflowX: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              border: '1px solid #1e293b',
            }}>
              {this.state.errorMessage}
            </pre>
          </details>

          <p style={{
            marginTop: '1.5rem', fontSize: '0.7rem', color: '#334155',
            textAlign: 'center', fontStyle: 'italic',
          }}>
            Your workout records are stored in IndexedDB and are not affected by either reset.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
