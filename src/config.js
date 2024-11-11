const getApiKey = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode');
    return process.env.REACT_APP_OPENAI_API_KEY;
  }
  
  console.log('Production mode');
  console.log('Window object exists:', typeof window !== 'undefined');
  
  if (typeof window === 'undefined') {
    return '';
  }
  
  // Add delay to ensure env-config.js has loaded
  setTimeout(() => {
    console.log('Delayed check - API key exists:', !!window.REACT_APP_OPENAI_API_KEY);
  }, 1000);
  
  return window.REACT_APP_OPENAI_API_KEY || '';
};

const config = {
  apiKey: getApiKey()
};

// Add verification logging
if (process.env.NODE_ENV === 'production') {
  console.log('Initial config state:', {
    hasWindow: typeof window !== 'undefined',
    hasApiKey: !!window.REACT_APP_OPENAI_API_KEY,
    configApiKey: !!config.apiKey
  });
}

export default config;
