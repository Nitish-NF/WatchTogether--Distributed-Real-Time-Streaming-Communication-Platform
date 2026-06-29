/**
 * Centralised options for the HttpOnly refresh-token cookie.
 * JS cannot read HttpOnly cookies, which eliminates the XSS theft vector.
 *
 * sameSite: 'lax'  (not 'strict')
 * ─────────────────────────────────
 * 'strict' would drop the cookie on any cross-site navigation, including:
 *   • Clicking the password-reset link from an email client
 *   • Returning from a future OAuth provider redirect
 * 'lax' still blocks cross-site POST (CSRF protection) while allowing
 * top-level GET navigations to carry the cookie. Combined with HttpOnly
 * and a scoped path this is the correct default for most deployments.
 * If your frontend and backend share the same domain (e.g. via a reverse
 * proxy), you can upgrade to 'strict' with no trade-offs.
 */
const COOKIE_NAME = 'wt_refresh';

const cookieOptions = () => ({
  httpOnly: true,                                   // JS cannot read this
  secure:   process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'lax',                                  // CSRF-safe, allows email links
  maxAge:   30 * 24 * 60 * 60 * 1000,              // 30 days in ms
  path:     '/api/auth',                            // scoped — sent on auth routes only
});

/**
 * Attach the refresh token as an HttpOnly cookie on the response.
 */
const setRefreshCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, cookieOptions());
};

/**
 * Clear the refresh cookie (logout / rotation).
 */
const clearRefreshCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/api/auth',
  });
};

module.exports = { COOKIE_NAME, setRefreshCookie, clearRefreshCookie };
