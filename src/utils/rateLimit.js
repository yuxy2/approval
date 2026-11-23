// In-memory store for rate limiting IP addresses.
// It uses a sliding-window algorithm to track client request timestamps.
const rateLimitMap = new Map();

// Periodic cleanup function to prevent memory leaks by removing expired IP tracks
if (typeof global._rateLimitCleanupInterval === 'undefined') {
  global._rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
      // Keep only timestamps younger than 10 minutes
      const active = timestamps.filter(t => now - t < 600000);
      if (active.length === 0) {
        rateLimitMap.delete(ip);
      } else {
        rateLimitMap.set(ip, active);
      }
    }
  }, 300000); // Run cleanup every 5 minutes
}

/**
 * Validates request count for a specific IP address.
 * 
 * @param {string} ip Client's IP address
 * @param {number} limit Maximum permitted requests within the window
 * @param {number} windowMs Time window in milliseconds (default 1 minute)
 * @returns {{limited: boolean, retryAfter: number}} Rate limiting assessment result
 */
export function rateLimit(ip, limit = 5, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap.get(ip);
  // Filter out timestamps outside the sliding-window
  const currentWindowRequests = timestamps.filter(t => now - t < windowMs);

  if (currentWindowRequests.length >= limit) {
    const oldestTimestamp = currentWindowRequests[0];
    const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    return {
      limited: true,
      retryAfter: Math.max(1, retryAfter)
    };
  }

  currentWindowRequests.push(now);
  rateLimitMap.set(ip, currentWindowRequests);
  
  return { limited: false, retryAfter: 0 };
}
