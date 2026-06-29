
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/main.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.js';
import { Toaster } from 'react-hot-toast';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <AuthProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#14141f',
            color: '#f0eee8',
            border: '0.5px solid rgba(255,255,255,0.1)',
          },
        }}
      />
    </AuthProvider>
);