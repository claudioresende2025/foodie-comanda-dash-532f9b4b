/**
 * useOfflineQuery - Hook para queries que funcionam 100% offline
 * 
 * Este hook garante que:
 * 1. Dados locais são SEMPRE retornados primeiro (nunca mostra loading quando há dados locais)
 * 2. Sincroniza com servidor em background quando online
 * 3. NUNCA falha - sempre retorna dados (mesmo que vazios)
 * 4. Persiste dados entre navegações de página
 */

import { useQuery, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { db } from './db';
import { supabase } from '@/integrations/supabase/client';

type TabelaLocal = 'mesas' | 'produtos' | 'categorias' | 'comandas' | 'pedidos' | 
                   'chamadas_garcom' | 'empresa' | 'caixa' | 'movimentacoes_caixa' | 
                   'vendas_concluidas' | 'pedidos_delivery' | 'itens_delivery';

interface UseOfflineQueryOptions<T> {
  queryKey: QueryKey;
  tabela: TabelaLocal;
  filtro?: { campo: string; valor: string | number };
  ordenar?: { campo: string; direcao?: 'asc' | 'desc' };
  select?: string;
  enabled?: boolean;
  transformLocal?: (dados: any[]) => T[];
  transformRemote?: (dados: any[]) => T[];
}

export function useOfflineQuery<T>({
  queryKey,
  tabela,
  filtro,
  ordenar,
  select = '*',
  enabled = true,
  transformLocal = (d) => d as T[],
  transformRemote = (d) => d as T[],
}: UseOfflineQueryOptions<T>) {
  const queryClient = useQueryClient();
  const [localData, setLocalData] = useState<T[]>([]);
  const [isLocalLoaded, setIsLocalLoaded] = useState(false);

  // Carregar dados locais imediatamente (síncrono com a renderização)
  useEffect(() => {
    if (!enabled) return;
    
    const loadLocal = async () => {
      try {
        const tabelaLocal = db[tabela];
        if (!tabelaLocal) return;
        
        let dados;
        if (filtro) {
          dados = await tabelaLocal.where(filtro.campo).equals(filtro.valor).toArray();
        } else {
          dados = await tabelaLocal.toArray();
        }
        
        // Ordenar se necessário
        if (ordenar && dados.length > 0) {
          dados.sort((a: any, b: any) => {
            const valA = a[ordenar.campo];
            const valB = b[ordenar.campo];
            if (ordenar.direcao === 'desc') {
              return valB > valA ? 1 : -1;
            }
            return valA > valB ? 1 : -1;
          });
        }
        
        const transformados = transformLocal(dados);
        setLocalData(transformados);
        
        // Pré-popular o cache do React Query com dados locais
        queryClient.setQueryData(queryKey, transformados);
        
        console.log(`[useOfflineQuery] ${tabela}: ${transformados.length} registros locais carregados`);
      } catch (err) {
        console.warn(`[useOfflineQuery] Erro ao carregar ${tabela} do IndexedDB:`, err);
      } finally {
        setIsLocalLoaded(true);
      }
    };
    
    loadLocal();
  }, [enabled, tabela, filtro?.campo, filtro?.valor, ordenar?.campo, ordenar?.direcao]);

  // Query para buscar do servidor (em background)
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      // Se offline, retornar dados locais imediatamente
      if (!navigator.onLine) {
        console.log(`[useOfflineQuery] ${tabela}: Offline - usando dados locais`);
        return localData;
      }
      
      try {
        let supabaseQuery = supabase.from(tabela).select(select);
        
        if (filtro) {
          supabaseQuery = supabaseQuery.eq(filtro.campo, filtro.valor);
        }
        
        if (ordenar) {
          supabaseQuery = supabaseQuery.order(ordenar.campo, { 
            ascending: ordenar.direcao !== 'desc' 
          });
        }
        
        const { data, error } = await supabaseQuery;
        
        if (error) {
          console.warn(`[useOfflineQuery] Erro do Supabase para ${tabela}:`, error);
          return localData; // Fallback para dados locais
        }
        
        if (data && data.length > 0) {
          // Salvar no IndexedDB
          const dadosComSync = data.map((item: any) => ({
            ...item,
            sincronizado: 1,
            numero: item.numero_mesa || item.numero, // compatibilidade mesas
          }));
          
          try {
            await db[tabela].bulkPut(dadosComSync);
            console.log(`[useOfflineQuery] ${tabela}: ${data.length} registros sincronizados`);
          } catch (e) {
            console.warn(`[useOfflineQuery] Erro ao salvar ${tabela}:`, e);
          }
          
          return transformRemote(data);
        }
        
        return localData;
      } catch (err) {
        console.warn(`[useOfflineQuery] ${tabela}: Supabase inacessível, usando local`);
        return localData;
      }
    },
    enabled: enabled && isLocalLoaded,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Dados iniciais são os dados locais (evita loading state)
    initialData: localData.length > 0 ? localData : undefined,
    // Nunca falhar
    retry: false,
  });

  return {
    data: query.data ?? localData,
    isLoading: !isLocalLoaded && query.isLoading,
    isLocalLoaded,
    isFetching: query.isFetching,
    refetch: query.refetch,
    error: query.error,
  };
}
