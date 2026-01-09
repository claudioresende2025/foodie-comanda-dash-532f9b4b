import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Tenta registrar o service worker para habilitar atualizações PWA
if ('serviceWorker' in navigator) {
	// registra o sw padrão em produção e fallback para dev-dist quando aplicável
	// Kill-switch: se `?no-sw=true` estiver presente na URL, desregistra qualquer SW e limpa caches
	const params = new URLSearchParams(window.location.search);
	if (params.get('no-sw') === 'true') {
		console.info('no-sw flag encontrada: desregistrando Service Worker e limpando caches');
		navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach(r => r.unregister())).catch(()=>{});
		if ('caches' in window) {
			caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(()=>{});
		}
		// não registra o SW quando a flag está ativa
	} else {
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
}
