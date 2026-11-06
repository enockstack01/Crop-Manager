import { Component } from 'react';
import { t } from '../i18n/index.js';

/**
 * Catches a page that failed to load or to draw. The most common case after a new release: an open tab asks for a page file
 * whose name has changed. "Try again" reloads the app, which fetches the new files; the rest of the app is never replaced by a blank page.
 */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { console.error('[page] failed:', error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="loading-state" role="alert">
        <p>{t('This page could not be loaded. Check your connection and try again.')}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t('Try again')}</button>
      </div>
    );
  }
}
