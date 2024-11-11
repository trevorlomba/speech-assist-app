const getApiKey = () => {
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_OPENAI_API_KEY;
  }
  
  try {
    const key = window.REACT_APP_OPENAI_API_KEY;
    console.log('Window API key type:', typeof key);
    console.log('Window API key exists:', !!key);
    return key;
  } catch (error) {
    console.error('Error accessing API key:', error);
    return '';
  }
};

const config = {
  apiKey: getApiKey()
};

export default config;
