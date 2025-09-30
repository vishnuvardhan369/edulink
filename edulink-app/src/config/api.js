const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000',
    socketURL: 'http://localhost:3000'
  },
  // Local network testing configuration
  localNetwork: {
    baseURL: 'http://10.12.151.180:3000',
    socketURL: 'http://10.12.151.180:3000'
  },
  // GitHub hosting configurations
  github: {
    baseURL: 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net',
    socketURL: 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net'
  },
  production: {
    baseURL: 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net',
    socketURL: 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net'
  }
};

// Enhanced environment detection with multiple fallbacks
const detectEnvironment = () => {
  // Check if we're in Azure App Services
  if (window.location.hostname.includes('azurewebsites.net')) {
    return 'production';
  }
  
  // Check for custom domain
  if (window.location.hostname === 'www.edulink.social' || window.location.hostname === 'edulink.social') {
    return 'production';
  }
  
  // Check for GitHub Pages hosting
  if (window.location.hostname.includes('github.io') || 
      window.location.hostname.includes('githubusercontent.com')) {
    return 'github';
  }
  
  // Check for GitHub Codespaces
  if (window.location.hostname.includes('codespaces.new') ||
      window.location.hostname.includes('github.dev') ||
      window.location.hostname.includes('preview.app.github.dev')) {
    return 'github';
  }
  
  // Check for Netlify, Vercel, or other common hosting platforms
  if (window.location.hostname.includes('netlify.app') ||
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('surge.sh') ||
      window.location.hostname.includes('herokuapp.com')) {
    return 'github';
  }
  
  // Check for local network IP access (for mobile testing)
  if (window.location.hostname === '10.12.151.180') {
    return 'localNetwork';
  }
  
  // Check for localhost variations
  if (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost') ||
    window.location.port === '5173' || // Vite dev server
    window.location.port === '5174' || // Alternative Vite dev server port
    window.location.port === '3000'    // Alternative dev port
  ) {
    return 'development';
  }
  
  // Default to production for any other domain
  return 'production';
};

const environment = detectEnvironment();

// Log environment detection for debugging
console.log('🌍 Environment Detection:', {
  hostname: window.location.hostname,
  port: window.location.port,
  href: window.location.href,
  detectedEnvironment: environment,
  selectedConfig: API_CONFIG[environment]
});

export const API_BASE_URL = API_CONFIG[environment].baseURL;
export const SOCKET_URL = API_CONFIG[environment].socketURL;

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  return fetch(url, { ...defaultOptions, ...options });
};

export default { API_BASE_URL, SOCKET_URL, apiCall };
