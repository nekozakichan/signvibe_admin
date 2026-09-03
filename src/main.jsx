import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/signvibe.css';
import { Chart as ChartJS } from 'chart.js';

// One motion vocabulary for every chart in the app — and none of it
// for people who have asked their system to keep motion to a minimum.
const prefersReducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

ChartJS.defaults.animation.duration = prefersReducedMotion ? 0 : 900;
ChartJS.defaults.animation.easing = 'easeOutQuart';
ChartJS.defaults.font.family =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
ChartJS.defaults.color = '#5a6a72';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);