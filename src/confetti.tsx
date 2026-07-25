import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Confetti, CONFETTI_TOTAL_MS } from './components/Confetti';
import './styles.css';

// Standalone full-screen celebration window — see showConfetti() in electron/main.ts. The window is
// created hidden at startup and kept warm, because building and loading one on the click cost a
// couple of very visible seconds. main fires it by calling __fireConfetti() through
// executeJavaScript, which avoids needing a preload just for one message.
//
// No StrictMode: its double-mount would fire two overlapping bursts.
function Host() {
  const [shot, setShot] = useState(0);
  (window as unknown as { __fireConfetti: () => number }).__fireConfetti = () => {
    setShot((n) => n + 1);
    return CONFETTI_TOTAL_MS;
  };
  // Nothing rendered until the first fire, so the warm window is genuinely idle.
  return shot === 0 ? null : <Confetti key={shot} />;
}

createRoot(document.getElementById('root')!).render(<Host />);
