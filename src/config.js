const config = {
  apiKey: process.env.NODE_ENV === 'development' 
    ? process.env.REACT_APP_OPENAI_API_KEY 
    : window.REACT_APP_OPENAI_API_KEY || ''
};

export default config;
