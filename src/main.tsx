import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Guard: never register SW in iframe or preview hosts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
} else if ('serviceWorker' in navigator) {
	const params = new URLSearchParams(window.location.search);
	if (params.get('no-sw') === 'true') {
		console.info('no-sw flag encontrada: desregistrando Service Worker e limpando caches');
		navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach(r => r.unregister())).catch(()=>{});
		if ('caches' in window) {
			caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(()=>{});
		}
	} else {
		const tryRegister = async () => {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js');
				console.log('Service worker registrado:', registration);
			} catch (e) {
				try {
					const registration = await navigator.serviceWorker.register('/dev-sw.js');
					console.log('Service worker (dev) registrado:', registration);
				} catch (err) {
					console.warn('Não foi possível registrar service worker:', err);
				}
			}
		};

		if (document.readyState === 'complete') tryRegister();
		else window.addEventListener('load', tryRegister);
	}
}
