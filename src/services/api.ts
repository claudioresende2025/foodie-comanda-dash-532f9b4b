// Configuração do IP fixo do seu servidor local (PC do Caixa)
const LOCAL_IP = "192.168.2.111";
const BASE_URL = `http://${LOCAL_IP}:3000/api/local`;

/**
 * Service Layer para comunicação com o Servidor Local (Híbrido)
 * Esta versão remove headers de autenticação automáticos para evitar erro 401 local.
 */
export const apiLocal = {

    // 1. Busca o Cardápio Completo (Produtos + Categorias)
    async getCardapio() {
        try {
            const response = await fetch(`${BASE_URL}/cardapio`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error("Falha ao ler cardápio local");
            return await response.json();
        } catch (error) {
            console.error("🚨 Servidor Local Offline", error);
            throw error;
        }
    },

    // 2. Busca Status do Dashboard (Mesas + Comandas Ativas)
    async getStatusGeral() {
        try {
            const response = await fetch(`${BASE_URL}/status-geral`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error("Falha ao ler mesas locais");
            return await response.json();
        } catch (error) {
            console.error("🚨 Servidor Local Offline", error);
            throw error;
        }
    },

    // 3. Busca apenas o array de Mesas (atalho sobre getStatusGeral)
    async getMesas() {
        try {
            const response = await fetch(`${BASE_URL}/status-geral`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error("Erro ao buscar mesas");
            const data = await response.json();
            return data.mesas || [];
        } catch (error) {
            console.error("🚨 Erro mesas locais", error);
            throw error;
        }
    },

    // 4. Cria uma nova Mesa no SQLite local
    async criarMesa(dados: {
        id: string;
        empresa_id: string;
        numero_mesa: number;
        capacidade: number;
    }) {
        try {
            const response = await fetch(`${BASE_URL}/mesas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Sem Authorization header
                body: JSON.stringify(dados),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro criar mesa local", error);
            throw error;
        }
    },

    // 5. Junta mesas no SQLite local
    async juntarMesas(dados: {
        masterMesaId: string;
        otherMesaIds: string[];
    }) {
        try {
            const response = await fetch(`${BASE_URL}/mesas/juntar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro juntar mesas local", error);
            throw error;
        }
    },

    // 6. Separa uma mesa em junção
    async separarMesa(dados: { mesaId: string }) {
        try {
            const response = await fetch(`${BASE_URL}/mesas/separar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro separar mesa local", error);
            throw error;
        }
    },

    // 7. Abre uma nova Comanda (Ocupa a mesa no SQLite)
    async abrirComanda(dados: {
        id: string;
        mesa_id: string;
        empresa_id: string;
        nome_cliente: string;
    }) {
        try {
            const response = await fetch(`${BASE_URL}/abrir-comanda`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro abrir comanda local", error);
            throw error;
        }
    },

    // 8. Envia o Carrinho de Pedidos (Lote de itens)
    async realizarPedido(pedidos: any[]) {
        try {
            const response = await fetch(`${BASE_URL}/realizar-pedido`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidos }),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro ao enviar pedidos para o caixa local", error);
            throw error;
        }
    },

    // 9. Login de Contingência (Equipe sincronizada)
    async loginLocal(credentials: { email: string; senha_hash: string }) {
        try {
            const response = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro no Login Local", error);
            throw error;
        }
    },
};