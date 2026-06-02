import axios from 'axios';

/**
 * Create an axios client with custom configuration and response interceptors
 * This replaces the base44 createAxiosClient function
 */
export const createAxiosClient = ({
  baseURL = '/',
  headers = {},
  token = null,
  interceptResponses = false
} = {}) => {
  const client = axios.create({
    baseURL,
    headers: {
      ...headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });

  if (interceptResponses) {
    client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        // Enrich error object with status and data properties
        const enrichedError = new Error(error.message);
        enrichedError.status = error.response?.status;
        enrichedError.data = error.response?.data;
        throw enrichedError;
      }
    );
  }

  return client;
};

/**
 * Create a simple authenticated HTTP client
 */
export const createAuthenticatedClient = (token) => {
  return createAxiosClient({
    headers: {
      'Content-Type': 'application/json'
    },
    token,
    interceptResponses: true
  });
};
