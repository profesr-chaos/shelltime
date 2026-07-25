import { createRoot } from 'react-dom/client';
import { Confetti } from './components/Confetti';
import './styles.css';

// Standalone full-screen celebration window — see showConfetti() in electron/main.ts. No StrictMode:
// its double-mount would fire two overlapping bursts and close the window on the first one's timer.
createRoot(document.getElementById('root')!).render(<Confetti onDone={() => window.close()} />);
