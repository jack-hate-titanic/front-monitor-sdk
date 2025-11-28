import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MonitorSDK from '../../dist/monitor-sdk.esm.js';

const sdk = new MonitorSDK({
  reportUrl: '/api/report',
  appVersion: '1.0.0',
  framework: 'react', // 指定React框架，自动注入ErrorBoundary
});

createRoot(document.getElementById('root')).render(
  <MonitorSDK.ReactErrorBoundary reporter={sdk.reporter} fallback="页面出错了">
    <App />
  </MonitorSDK.ReactErrorBoundary>
)