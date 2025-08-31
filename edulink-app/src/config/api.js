// API Configuration for different environments
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000',
    socketURL: 'http://localhost:3000'
  },
  production: {
    baseURL: 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net',
    socketURL: 'https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net'
  }
};

// Detect environment
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const environment = isDevelopment ? 'development' : 'production';

export const API_BASE_URL = API_CONFIG[environment].baseURL;
export const SOCKET_URL = API_CONFIG[environment].socketURL;

// Helper function to make API calls
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
