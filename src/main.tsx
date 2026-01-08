import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Tenta registrar o service worker para habilitar atualizações PWA
if ('serviceWorker' in navigator) {
	// registra o sw padrão em produção e fallback para dev-dist quando aplicável
	const tryRegister = async () => {
		try {
			// prioriza sw na raiz (/sw.js) — adaptável dependendo do build
			const registration = await navigator.serviceWorker.register('/sw.js');
			console.log('Service worker registrado:', registration);
		} catch (e) {
			try {
				// fallback para ambiente de desenvolvimento (dev-dist)
				const registration = await navigator.serviceWorker.register('/dev-sw.js');
				console.log('Service worker (dev) registrado:', registration);
			} catch (err) {
				console.warn('Não foi possível registrar service worker:', err);
			}
		}
	};

	// registra após carga completa para evitar conflitos com SSR/hidratation
	if (document.readyState === 'complete') tryRegister();
	else window.addEventListener('load', tryRegister);
}
