/**
 * Wrap async route handlers to forward errors to Express error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Standard success response shape.
 */
const sendSuccess = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

/**
 * Standard error response shape.
 */
const sendError = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

/**
 * Pagination helper. Returns { skip, limit, page, totalPages } given query params.
 */
const paginate = (query, total) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, parseInt(query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit, totalPages: Math.ceil(total / limit) };
};

// ── Helpers ───────────────────────────────────────────────────────────────

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Parse a User-Agent string into a short human-readable device name.
 * Shown in the "Active Sessions" list.
 * e.g. "Chrome on Windows", "Safari on iPhone", "Firefox on Mac"
 */
const parseDeviceName = (userAgent = '') => {
  if (!userAgent) return 'Unknown device';

  const ua = userAgent.toLowerCase();

  // OS
  let os = 'Unknown OS';
  if (ua.includes('iphone'))                os = 'iPhone';
  else if (ua.includes('ipad'))             os = 'iPad';
  else if (ua.includes('android'))          os = 'Android';
  else if (ua.includes('windows'))          os = 'Windows';
  else if (ua.includes('mac os'))           os = 'Mac';
  else if (ua.includes('linux'))            os = 'Linux';

  // Browser
  let browser = 'Unknown browser';
  if (ua.includes('edg/'))                  browser = 'Edge';
  else if (ua.includes('chrome'))           browser = 'Chrome';
  else if (ua.includes('firefox'))          browser = 'Firefox';
  else if (ua.includes('safari'))           browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

  return `${browser} on ${os}`;
};

module.exports = { asyncHandler, sendSuccess, sendError, paginate ,hashToken,parseDeviceName};