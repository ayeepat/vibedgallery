/**
 * Centralized error handling utility
 * Provides consistent error logging, user messages, and notifications
 */

export const ErrorHandler = {
  /**
   * Log error to console (development only)
   */
  log: (context, error) => {
    if (import.meta.env.DEV) {
      console.error(`[${context}]`, error);
    }
  },

  /**
   * Extract user-friendly message from error
   */
  getMessage: (error, defaultMessage = 'Something went wrong. Please try again.') => {
    if (!error) return defaultMessage;
    
    if (typeof error === 'string') return error;
    
    if (error.message) {
      // Handle specific error patterns
      if (error.message.includes('auth')) return 'Authentication failed. Please try logging in again.';
      if (error.message.includes('network') || error.message.includes('fetch')) return 'Network error. Please check your connection.';
      if (error.message.includes('permission') || error.message.includes('403')) return 'You do not have permission to perform this action.';
      if (error.message.includes('not found') || error.message.includes('404')) return 'The requested item was not found.';
      if (error.message.includes('timeout')) return 'Request timed out. Please try again.';
      
      return error.message;
    }
    
    return defaultMessage;
  },

  /**
   * Handle API errors consistently
   */
  handleApiError: (error, context = 'API Error') => {
    ErrorHandler.log(context, error);
    
    const message = ErrorHandler.getMessage(error);
    
    return {
      success: false,
      error: true,
      message,
      originalError: error
    };
  },

  /**
   * Handle async operations with consistent error handling
   */
  handleAsync: async (asyncFn, context = 'Async Operation') => {
    try {
      const result = await asyncFn();
      return { success: true, data: result };
    } catch (error) {
      ErrorHandler.log(context, error);
      return {
        success: false,
        error: true,
        message: ErrorHandler.getMessage(error),
        originalError: error
      };
    }
  },

  /**
   * Validate required fields
   */
  validateRequired: (fields, data) => {
    const missing = fields.filter(field => !data[field]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        message: `Missing required fields: ${missing.join(', ')}`
      };
    }
    
    return { valid: true };
  },

  /**
   * Handle file upload errors
   */
  handleUploadError: (error) => {
    if (error.message.includes('size')) {
      return 'File is too large. Maximum 5MB.';
    }
    if (error.message.includes('type')) {
      return 'File type not supported. Use JPG, PNG, WebP, or GIF.';
    }
    if (error.message.includes('dimension') || error.message.includes('pixel')) {
      return 'Image dimensions must be at least 200x100 pixels.';
    }
    
    return ErrorHandler.getMessage(error, 'Failed to upload file. Please try again.');
  },

  /**
   * Supabase-specific error handler
   */
  handleSupabaseError: (error) => {
    if (!error) return 'An unknown error occurred.';
    
    const msg = error.message?.toLowerCase() || '';
    
    if (msg.includes('unique')) return 'This item already exists.';
    if (msg.includes('foreign key')) return 'Invalid reference. Please check and try again.';
    if (msg.includes('permission denied')) return 'You do not have permission to perform this action.';
    if (msg.includes('jwt')) return 'Session expired. Please log in again.';
    if (msg.includes('rate limit')) return 'Too many requests. Please wait a moment and try again.';
    
    return ErrorHandler.getMessage(error);
  },
};

export default ErrorHandler;
