/**
 * Router utility for handling navigation in the Zinc Housing app
 * Supports both .html extensions and clean URLs
 */

const routes = {
  '/': '/index.html',
  '/planner': '/planner.html',
  '/location': '/location.html',
  '/breakdown': '/breakdown.html',
  '/results': '/results.html',
  '/transition': '/transition.html',
  '/ping': '/ping.html'
};

/**
 * Navigate to a route with optional delay
 * @param {string} path - Route path (e.g., '/planner' or 'planner.html')
 * @param {number} delay - Optional delay in milliseconds
 */
export function navigateTo(path, delay = 0) {
  // Normalize the path
  let normalizedPath = path;

  // If path doesn't start with /, add it
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }

  // Remove .html extension if present for clean URLs
  if (normalizedPath.endsWith('.html')) {
    normalizedPath = normalizedPath.replace('.html', '');
  }

  // Special case for root
  if (normalizedPath === '/index') {
    normalizedPath = '/';
  }

  const navigate = () => {
    // In production (built), use clean URLs
    // In development, append .html
    const isDev = import.meta.env.DEV;
    const targetPath = isDev && normalizedPath !== '/'
      ? normalizedPath + '.html'
      : normalizedPath;

    window.location.href = targetPath;
  };

  if (delay > 0) {
    setTimeout(navigate, delay);
  } else {
    navigate();
  }
}

/**
 * Get the current route path
 * @returns {string} Current route path
 */
export function getCurrentRoute() {
  let path = window.location.pathname;

  // Remove .html extension if present
  if (path.endsWith('.html')) {
    path = path.replace('.html', '');
  }

  // Handle root
  if (path === '/index' || path === '') {
    return '/';
  }

  return path;
}

/**
 * Check if current route matches a given path
 * @param {string} path - Path to check
 * @returns {boolean}
 */
export function isCurrentRoute(path) {
  const currentRoute = getCurrentRoute();
  let normalizedPath = path;

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }

  if (normalizedPath.endsWith('.html')) {
    normalizedPath = normalizedPath.replace('.html', '');
  }

  if (normalizedPath === '/index') {
    normalizedPath = '/';
  }

  return currentRoute === normalizedPath;
}

export default {
  navigateTo,
  getCurrentRoute,
  isCurrentRoute,
  routes
};
