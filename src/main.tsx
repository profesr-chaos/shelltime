import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PrintReport } from './pages/PrintReport';
import './styles.css';

const params = new URLSearchParams(window.location.search);
const printMonth = params.get('print');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{printMonth ? <PrintReport month={printMonth} /> : <App />}</StrictMode>
);
