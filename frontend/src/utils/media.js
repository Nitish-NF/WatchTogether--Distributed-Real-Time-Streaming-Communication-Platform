const STREAM_BASE_URL =
  process.env.REACT_APP_STREAM_URL ||
  'http://localhost:8080';

export const formatStreamUrl = (url = '') => {

  if (!url) return '';

  if (url.startsWith('http')) {
    return url;
  }

  return `${STREAM_BASE_URL}${url}`;
};

// Use formatStreamUrl for both stream and thumbnail paths — same base URL applies.