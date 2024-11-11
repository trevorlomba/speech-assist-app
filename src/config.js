const config = {
  apiKey: process.env.NODE_ENV === 'development' 
    ? process.env.REACT_APP_OPENAI_API_KEY 
    : (typeof window !== 'undefined' && window.REACT_APP_OPENAI_API_KEY) || ''
};

// Debug logging
if (process.env.NODE_ENV === 'production') {
  console.log('Window API key exists:', !!window.REACT_APP_OPENAI_API_KEY);
  console.log('Config API key exists:', !!config.apiKey);
}

export default config;
