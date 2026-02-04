// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.20.72:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;