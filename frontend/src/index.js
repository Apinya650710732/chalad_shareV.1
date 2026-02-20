import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import axios from "axios";

const root = ReactDOM.createRoot(document.getElementById('root'));
axios.defaults.baseURL = "http://localhost:8080/api/v1";
axios.defaults.withCredentials = true;

axios.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || ""; // เช่น "/auth/login"

    // ✅ ไม่ redirect สำหรับ auth endpoints (ให้หน้าแสดง error เอง)
    const skipRedirect =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/verify-otp") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/logout");

    if (status === 401 && !skipRedirect) {
      window.location.replace("/");
    }

    return Promise.reject(err);
  }
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
