const waitForApiKey = () => {
  return new Promise((resolve) => {
    if (window.REACT_APP_OPENAI_API_KEY) {
      resolve(window.REACT_APP_OPENAI_API_KEY);
      return;
    }

    // Wait for env-config.js to load
    window.addEventListener('load', () => {
      setTimeout(() => {
        resolve(window.REACT_APP_OPENAI_API_KEY || '');
      }, 100);
    });
  });
};

const config = {
  apiKey: '',
  initialize: async () => {
    if (process.env.NODE_ENV === 'development') {
      config.apiKey = process.env.REACT_APP_OPENAI_API_KEY;
      return;
    }
    
    config.apiKey = await waitForApiKey();
    console.log('API key initialized:', !!config.apiKey);
  }
};

// Initialize immediately
config.initialize();

export default config;
