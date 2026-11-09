import { clerkMiddleware } from '@clerk/express';

/*
 * Reads the Clerk session from the Authorization header (apps) or the session cookie (web) on every request.
 *
 * Clerk's own code throws a plain SyntaxError or TypeError when a token has the shape of a login token but is damaged (for example
 * a half-saved token on a phone). Left alone, that became "500 Server error" with an error page, and the app could not tell it had to
 * sign in again. A damaged token is just an invalid login: the request continues as NOT signed in, so a protected route answers 401
 * ("Authentication required", the app signs in again) and a public route (the referral-link page) still works. Real faults (Clerk
 * unreachable, a wrong CLERK_SECRET_KEY) still pass through as server errors so they are seen and logged.
 */
const clerk = clerkMiddleware();

const isBadToken = (err) => !!err && ['SyntaxError', 'TypeError', 'URIError'].includes(err.name) && err.status === undefined;

export function clerkSession(req, res, next) {
  const run = (retry) => {
    const done = (err) => {
      if (isBadToken(err) && retry) { // damaged token: carry on as if none was sent
        delete req.headers.authorization;
        return run(false);
      }
      return next(err);
    };
    try {
      clerk(req, res, done);
    } catch (err) {
      done(err);
    }
  };
  run(true);
}
