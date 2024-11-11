export const getApiKey = () => {
  return process.env.REACT_APP_OPENAI_API_KEY || '';
};
