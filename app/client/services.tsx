import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.X.X:3000', // IP local, NO localhost
});

export const setAuthToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export default api;