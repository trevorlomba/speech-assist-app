const config = {
  apiKey: process.env.NODE_ENV === 'development' 
    ? process.env.REACT_APP_OPENAI_API_KEY 
    : window.REACT_APP_OPENAI_API_KEY
};

// Temporary debug logging (remove in production)
console.log('Environment:', process.env.NODE_ENV);
console.log('API Key exists:', !!config.apiKey);
console.log('API Key length:', config.apiKey ? config.apiKey.length : 0);

export default config;
