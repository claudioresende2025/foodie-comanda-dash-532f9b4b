import Dexie, { Table } from 'dexie'

// ─── Interfaces (espelham as tabelas do Supabase) ───────────────────────────

export interface LocalCategoria {
  id: string
  empresa_id: string
  nome: string
  descricao?: string
  ordem?: number
  ativo: boolean
  created_at: string
  updated_at: string
  _synced: boolean
  _deleted: boolean
  _local_version: number
}

export interface LocalProduct {
  id: string
  empresa_id: string
  categoria_id: string
  nome: string
  descricao?: string
  preco: number
  ativo: boolean
  imagem_url?: string
  ncm?: string
  variacoes?: any
  created_at: string
  updated_at: string
  _synced: boolean
  _deleted: boolean
  _local_version: number
}

export interface LocalMesa {
  id: string
  empresa_id: string
  numero_mesa: number
  status: string
  capacidade?: number
  mesa_juncao_id?: string
  created_at: string
  updated_at: string
  _synced: boolean
  _deleted: boolean
  _local_version: number
}

export interface LocalComanda {
  id: string
  empresa_id: string
  mesa_id?: string
  status: string
  nome_cliente?: string
  telefone_cliente?: string
  qr_code_sessao?: string
  comanda_mestre_id?: string
  total?: number
  forma_pagamento?: string
  troco_para?: number
  data_fechamento?: string
  created_at: string
  updated_at: string
  _synced: boolean
  _deleted: boolean
  _local_version: number
}

export interface LocalPedido {
  id: string
  comanda_id: string
  produto_id?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  status_cozinha: string
  notas_cliente?: string
  created_at: string
  updated_at: string
  _synced: boolean
  _deleted: boolean
  _local_version: number
}

export interface SyncQueueItem {
  id?: number
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  record_id: string
  empresa_id: string
  payload: string
  created_at: string
  attempts: number
  last_error?: string
}

// ─── Classe do banco local ──────────────────────────────────────────────────

class FoodComandaDB extends Dexie {
  categorias!: Table<LocalCategoria>
  produtos!: Table<LocalProduct>
  mesas!: Table<LocalMesa>
  comandas!: Table<LocalComanda>
  pedidos!: Table<LocalPedido>
  sync_queue!: Table<SyncQueueItem>

  constructor() {
    super('FoodComandaProDB')

    this.version(1).stores({
      categorias: 'id, empresa_id, ativo, _synced, _deleted',
      produtos: 'id, empresa_id, categoria_id, ativo, _synced, _deleted',
      mesas: 'id, empresa_id, status, _synced, _deleted',
      comandas: 'id, empresa_id, mesa_id, status, _synced, _deleted',
      pedidos: 'id, comanda_id, produto_id, status_cozinha, _synced, _deleted',
      sync_queue: '++id, table_name, operation, record_id, empresa_id, created_at, attempts',
    })
  }
}

export const localDb = new FoodComandaDB()
