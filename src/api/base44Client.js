// This file is deprecated. Use httpClient.js instead.
// Keeping for backwards compatibility if needed.

export const db = {
  auth: {
    isAuthenticated: async () => false,
    me: async () => null
  },
  entities: new Proxy({}, {
    get: () => ({
      filter: async () => [],
      get: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({})
    })
  }),
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' })
    }
  }
};

export default db;
