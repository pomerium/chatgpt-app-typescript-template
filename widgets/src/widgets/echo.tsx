import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Echo from '../echo/Echo';
import '../index.css';

// Widget entry point - mounts the Echo component
const rootElement = document.getElementById('echo-root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Echo />
    </StrictMode>
  );
}
