// Configuração do IP fixo do seu servidor local (PC do Caixa)
const LOCAL_IP = "192.168.2.111";
const BASE_URL = `http://${LOCAL_IP}:3000/api/local`;

/**
 * Service Layer para comunicação com o Servidor Local (Híbrido)
 * Este serviço prioriza a operação offline-first no restaurante.
 */
export const apiLocal = {

    // 1. Busca o Cardápio Completo (Produtos + Categorias)
    async getCardapio() {
        try {
            const response = await fetch(`${BASE_URL}/cardapio`);
            if (!response.ok) throw new Error("Falha ao ler cardápio local");
            return await response.json(); // Retorna { produtos, categorias }
        } catch (error) {
            console.error("🚨 Erro: Servidor Local de Cardápio inacessível", error);
            throw error;
        }
    },

    // 2. Busca Status do Dashboard (Mesas + Comandas Ativas)
    async getStatusGeral() {
        try {
            const response = await fetch(`${BASE_URL}/status-geral`);
            if (!response.ok) throw new Error("Falha ao ler mesas locais");
            return await response.json(); // Retorna { mesas, comandas }
        } catch (error) {
            console.error("🚨 Erro: Servidor Local de Mesas inacessível", error);
            throw error;
        }
    },

    // 3. Abre uma nova Comanda (Ocupa a mesa no SQLite)
    async abrirComanda(dados: {
        id: string;
        mesa_id: string;
        empresa_id: string;
        nome_cliente: string
    }) {
        try {
            const response = await fetch(`${BASE_URL}/abrir-comanda`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados),
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro ao abrir comanda localmente", error);
            throw error;
        }
    },

    // 4. Envia o Carrinho de Pedidos (Lote de itens)
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

    // 5. Busca Sugestões de Upsell (Offline)
    async getUpsell() {
        try {
            const response = await fetch(`${BASE_URL}/upsell`);
            if (!response.ok) throw new Error("Erro no Upsell local");
            return await response.json();
        } catch (error) {
            console.error("🚨 Erro ao buscar upsell local", error);
            return []; // Retorna vazio em caso de erro para não travar o modal
        }
    },

    // 6. Login de Contingência (Equipe sincronizada)
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
    }
};