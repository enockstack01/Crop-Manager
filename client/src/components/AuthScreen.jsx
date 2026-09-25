import { Link } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { LeafMark } from './LeafMark.jsx';

// brand the Clerk form; our own sign-in / sign-up switch link replaces Clerk's card footer
const appearance = {
  layout: { socialButtonsVariant: 'blockButton', socialButtonsPlacement: 'top' },
  variables: { colorPrimary: '#2E7D32', borderRadius: '10px', fontFamily: 'Inter, system-ui, sans-serif' },
  elements: {
    footerAction: { display: 'none' },
    socialButtonsBlockButton: { minHeight: '46px', fontWeight: 600 },
    formButtonPrimary: { minHeight: '44px', fontWeight: 700 },
  },
};

/**
 * Split-screen landing for signed-out visitors: brand panel on the left,
 * Clerk sign-in / sign-up form on the right (brand panel hides on mobile).
 */
export function AuthScreen({ mode = 'sign-in' }) {
  const isSignUp = mode === 'sign-up';
  return (
    <div className="auth-split">
      <div className="auth-split-brand">
        <div className="auth-split-brand-icon">
          <LeafMark size={96} color="#fff" />
        </div>
        <h1>CropManager</h1>
        <p>
          Streamline your crop production. Track farms, fields, crop cycles, activities, harvests,
          inventory, and finances — all in one place.
        </p>
      </div>

      <div className="auth-split-form">
        <div className="auth-split-form-wrapper">
          <div className="auth-split-mobile-brand" aria-hidden="true">
            <span className="auth-split-mobile-logo">
              <LeafMark size={26} color="#fff" />
            </span>
            CropManager
          </div>
          <h2>{isSignUp ? 'Create your account' : 'Welcome'}</h2>
          <p className="subtitle">
            {isSignUp ? 'Start managing your crop production today' : 'Sign in to your farm management dashboard'}
          </p>

          {isSignUp ? (
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" appearance={appearance} />
          ) : (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" appearance={appearance} />
          )}

          <p className="subtitle auth-split-switch">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Link to={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Sign up'}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
