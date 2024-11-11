const getApiKey = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode');
    return process.env.REACT_APP_OPENAI_API_KEY;
  }
  
  console.log('Production mode');
  if (typeof window === 'undefined') {
    console.log('Window is undefined');
    return '';
  }
  
  if (!window.REACT_APP_OPENAI_API_KEY) {
    console.log('API key not found in window');
    return '';
  }
  
  console.log('API key found in window');
  return window.REACT_APP_OPENAI_API_KEY;
};

const config = {
  apiKey: getApiKey()
};

// Log config state
console.log('Config initialized with API key:', !!config.apiKey);

export default config;
