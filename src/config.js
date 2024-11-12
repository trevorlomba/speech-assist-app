const config = {
  apiUrl: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001'
    : 'https://speech-assist-server.onrender.com' 
};

export default config;
