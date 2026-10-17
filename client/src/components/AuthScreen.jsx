import { Link } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { BrandPanel, MobileBrand } from './Brand.jsx';
import { t } from '../i18n/index.js';

// brand the Clerk form; our own sign-in / sign-up switch link replaces Clerk's card footer
const appearance = {
  layout: { socialButtonsVariant: 'blockButton', socialButtonsPlacement: 'top' },
  variables: { colorPrimary: '#1B5E20', colorText: '#1C2B1E', borderRadius: '10px', fontFamily: 'Calibri, Carlito, Arial, sans-serif' },
  elements: {
    footerAction: { display: 'none' },
    socialButtonsBlockButton: { minHeight: '46px', fontWeight: 600 },
    formButtonPrimary: { minHeight: '44px', fontWeight: 700, backgroundImage: 'none', backgroundColor: '#1B5E20', boxShadow: 'none', '&:hover': { backgroundColor: '#14532D' } },
    card: { boxShadow: 'none', border: '1px solid #D5E3D6' },
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
      <BrandPanel />

      <div className="auth-split-form">
        <div className="auth-split-form-wrapper">
          <MobileBrand />
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
