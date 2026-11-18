import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TrainerApp } from './TrainerApp.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('The page has no #root element');
}
createRoot(root).render(
  <StrictMode>
    <TrainerApp />
  </StrictMode>,
);
