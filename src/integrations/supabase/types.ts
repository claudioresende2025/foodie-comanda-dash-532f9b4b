export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      avaliacoes: {
        Row: {
          comentario: string | null
          created_at: string
          empresa_id: string
          id: string
          nota_entrega: number | null
          nota_pedido: number | null
          pedido_delivery_id: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nota_entrega?: number | null
          nota_pedido?: number | null
          pedido_delivery_id: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nota_entrega?: number | null
          nota_pedido?: number | null
          pedido_delivery_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_pedido_delivery_id_fkey"
            columns: ["pedido_delivery_id"]
            isOneToOne: true
            referencedRelation: "pedidos_delivery"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          created_at: string
          data_abertura: string
          data_fechamento: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          status: string
          usuario_id: string
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          status?: string
          usuario_id: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Update: {
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          usuario_id?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamadas_garcom: {
        Row: {
          atendida_at: string | null
          comanda_id: string | null
          created_at: string
          empresa_id: string
          id: string
          mesa_id: string
          status: string
        }
        Insert: {
          atendida_at?: string | null
          comanda_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          mesa_id: string
          status?: string
        }
        Update: {
          atendida_at?: string | null
          comanda_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          mesa_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamadas_garcom_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_garcom_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_garcom_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          comanda_mestre_id: string | null
          created_at: string
          data_fechamento: string | null
          empresa_id: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          mesa_id: string | null
          nome_cliente: string | null
          qr_code_sessao: string | null
          status: Database["public"]["Enums"]["comanda_status"] | null
          telefone_cliente: string | null
          total: number | null
          troco_para: number | null
          updated_at: string
        }
        Insert: {
          comanda_mestre_id?: string | null
          created_at?: string
          data_fechamento?: string | null
          empresa_id: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          mesa_id?: string | null
          nome_cliente?: string | null
          qr_code_sessao?: string | null
          status?: Database["public"]["Enums"]["comanda_status"] | null
          telefone_cliente?: string | null
          total?: number | null
          troco_para?: number | null
          updated_at?: string
        }
        Update: {
          comanda_mestre_id?: string | null
          created_at?: string
          data_fechamento?: string | null
          empresa_id?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          mesa_id?: string | null
          nome_cliente?: string | null
          qr_code_sessao?: string | null
          status?: Database["public"]["Enums"]["comanda_status"] | null
          telefone_cliente?: string | null
          total?: number | null
          troco_para?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comandas_comanda_mestre_id_fkey"
            columns: ["comanda_mestre_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_itens: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          produto_id: string
          quantidade: number
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          produto_id: string
          quantidade?: number
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_itens_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          imagem_url: string | null
          nome: string
          preco_combo: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          imagem_url?: string | null
          nome: string
          preco_combo: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          imagem_url?: string | null
          nome?: string
          preco_combo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_delivery: {
        Row: {
          created_at: string
          delivery_ativo: boolean
          empresa_id: string
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          pedido_minimo: number
          raio_entrega_km: number | null
          taxa_entrega: number
          tempo_estimado_max: number
          tempo_estimado_min: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_ativo?: boolean
          empresa_id: string
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          pedido_minimo?: number
          raio_entrega_km?: number | null
          taxa_entrega?: number
          tempo_estimado_max?: number
          tempo_estimado_min?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_ativo?: boolean
          empresa_id?: string
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          pedido_minimo?: number
          raio_entrega_km?: number | null
          taxa_entrega?: number
          tempo_estimado_max?: number
          tempo_estimado_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_delivery_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          tipo: string
          updated_at: string
          uso_atual: number | null
          uso_maximo: number | null
          valor: number
          valor_minimo_pedido: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          id?: string
          tipo?: string
          updated_at?: string
          uso_atual?: number | null
          uso_maximo?: number | null
          valor: number
          valor_minimo_pedido?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          tipo?: string
          updated_at?: string
          uso_atual?: number | null
          uso_maximo?: number | null
          valor?: number
          valor_minimo_pedido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons_uso: {
        Row: {
          created_at: string
          cupom_id: string
          id: string
          pedido_delivery_id: string | null
          user_id: string
          valor_desconto: number
        }
        Insert: {
          created_at?: string
          cupom_id: string
          id?: string
          pedido_delivery_id?: string | null
          user_id: string
          valor_desconto: number
        }
        Update: {
          created_at?: string
          cupom_id?: string
          id?: string
          pedido_delivery_id?: string | null
          user_id?: string
          valor_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_uso_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_uso_pedido_delivery_id_fkey"
            columns: ["pedido_delivery_id"]
            isOneToOne: false
            referencedRelation: "pedidos_delivery"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          chave_pix: string | null
          cnpj: string | null
          created_at: string
          endereco_completo: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          nome_fantasia: string
          updated_at: string
          usuario_proprietario_id: string | null
        }
        Insert: {
          chave_pix?: string | null
          cnpj?: string | null
          created_at?: string
          endereco_completo?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome_fantasia: string
          updated_at?: string
          usuario_proprietario_id?: string | null
        }
        Update: {
          chave_pix?: string | null
          cnpj?: string | null
          created_at?: string
          endereco_completo?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          updated_at?: string
          usuario_proprietario_id?: string | null
        }
        Relationships: []
      }
      enderecos_cliente: {
        Row: {
          bairro: string
          cep: string | null
          cidade: string
          complemento: string | null
          created_at: string
          estado: string
          id: string
          is_default: boolean
          nome_cliente: string
          numero: string
          referencia: string | null
          rua: string
          telefone: string
          user_id: string | null
        }
        Insert: {
          bairro: string
          cep?: string | null
          cidade: string
          complemento?: string | null
          created_at?: string
          estado?: string
          id?: string
          is_default?: boolean
          nome_cliente: string
          numero: string
          referencia?: string | null
          rua: string
          telefone: string
          user_id?: string | null
        }
        Update: {
          bairro?: string
          cep?: string | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          estado?: string
          id?: string
          is_default?: boolean
          nome_cliente?: string
          numero?: string
          referencia?: string | null
          rua?: string
          telefone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fidelidade_config: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          pontos_necessarios: number
          pontos_por_real: number
          updated_at: string
          valor_recompensa: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          pontos_necessarios?: number
          pontos_por_real?: number
          updated_at?: string
          valor_recompensa?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          pontos_necessarios?: number
          pontos_por_real?: number
          updated_at?: string
          valor_recompensa?: number
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fidelidade_pontos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          pontos: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          pontos?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          pontos?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_pontos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fidelidade_transacoes: {
        Row: {
          created_at: string
          descricao: string | null
          fidelidade_id: string
          id: string
          pedido_delivery_id: string | null
          pontos: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          fidelidade_id: string
          id?: string
          pedido_delivery_id?: string | null
          pontos: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          fidelidade_id?: string
          id?: string
          pedido_delivery_id?: string | null
          pontos?: number
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_transacoes_fidelidade_id_fkey"
            columns: ["fidelidade_id"]
            isOneToOne: false
            referencedRelation: "fidelidade_pontos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_transacoes_pedido_delivery_id_fkey"
            columns: ["pedido_delivery_id"]
            isOneToOne: false
            referencedRelation: "pedidos_delivery"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_delivery: {
        Row: {
          created_at: string
          id: string
          nome_produto: string
          notas: string | null
          pedido_delivery_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome_produto: string
          notas?: string | null
          pedido_delivery_id: string
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          nome_produto?: string
          notas?: string | null
          pedido_delivery_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_delivery_pedido_delivery_id_fkey"
            columns: ["pedido_delivery_id"]
            isOneToOne: false
            referencedRelation: "pedidos_delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_delivery_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      mesas: {
        Row: {
          capacidade: number | null
          created_at: string
          empresa_id: string
          id: string
          mesa_juncao_id: string | null
          numero_mesa: number
          status: Database["public"]["Enums"]["mesa_status"] | null
          updated_at: string
        }
        Insert: {
          capacidade?: number | null
          created_at?: string
          empresa_id: string
          id?: string
          mesa_juncao_id?: string | null
          numero_mesa: number
          status?: Database["public"]["Enums"]["mesa_status"] | null
          updated_at?: string
        }
        Update: {
          capacidade?: number | null
          created_at?: string
          empresa_id?: string
          id?: string
          mesa_juncao_id?: string | null
          numero_mesa?: number
          status?: Database["public"]["Enums"]["mesa_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesas_mesa_juncao_id_fkey"
            columns: ["mesa_juncao_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_caixa: {
        Row: {
          caixa_id: string
          comanda_id: string | null
          created_at: string
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          pedido_delivery_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          caixa_id: string
          comanda_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          pedido_delivery_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          caixa_id?: string
          comanda_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          pedido_delivery_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_pedido_delivery_id_fkey"
            columns: ["pedido_delivery_id"]
            isOneToOne: false
            referencedRelation: "pedidos_delivery"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          comanda_id: string
          created_at: string
          id: string
          notas_cliente: string | null
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          status_cozinha: Database["public"]["Enums"]["pedido_status"] | null
          subtotal: number
          updated_at: string
        }
        Insert: {
          comanda_id: string
          created_at?: string
          id?: string
          notas_cliente?: string | null
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
          status_cozinha?: Database["public"]["Enums"]["pedido_status"] | null
          subtotal: number
          updated_at?: string
        }
        Update: {
          comanda_id?: string
          created_at?: string
          id?: string
          notas_cliente?: string | null
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          status_cozinha?: Database["public"]["Enums"]["pedido_status"] | null
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_delivery: {
        Row: {
          agendado_para: string | null
          created_at: string
          cupom_id: string | null
          desconto: number | null
          empresa_id: string
          endereco_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          notas: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          stripe_payment_id: string | null
          stripe_payment_status: string | null
          subtotal: number
          taxa_entrega: number
          total: number
          troco_para: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agendado_para?: string | null
          created_at?: string
          cupom_id?: string | null
          desconto?: number | null
          empresa_id: string
          endereco_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          notas?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          stripe_payment_id?: string | null
          stripe_payment_status?: string | null
          subtotal?: number
          taxa_entrega?: number
          total?: number
          troco_para?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agendado_para?: string | null
          created_at?: string
          cupom_id?: string | null
          desconto?: number | null
          empresa_id?: string
          endereco_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          notas?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          stripe_payment_id?: string | null
          stripe_payment_status?: string | null
          subtotal?: number
          taxa_entrega?: number
          total?: number
          troco_para?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_delivery_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_delivery_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_delivery_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "enderecos_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          imagem_url: string | null
          nome: string
          preco: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          imagem_url?: string | null
          nome: string
          preco: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          imagem_url?: string | null
          nome?: string
          preco?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      promocao_itens: {
        Row: {
          created_at: string
          id: string
          produto_id: string
          promocao_id: string
          quantidade: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          produto_id: string
          promocao_id: string
          quantidade?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          produto_id?: string
          promocao_id?: string
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promocao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promocao_itens_promocao_id_fkey"
            columns: ["promocao_id"]
            isOneToOne: false
            referencedRelation: "promocoes"
            referencedColumns: ["id"]
          },
        ]
      }
      promocoes: {
        Row: {
          ativo: boolean | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          dias_semana: number[] | null
          empresa_id: string
          id: string
          imagem_url: string | null
          nome: string
          preco_promocional: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          dias_semana?: number[] | null
          empresa_id: string
          id?: string
          imagem_url?: string | null
          nome: string
          preco_promocional: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          dias_semana?: number[] | null
          empresa_id?: string
          id?: string
          imagem_url?: string | null
          nome?: string
          preco_promocional?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promocoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          created_at: string
          data_reserva: string
          email_cliente: string | null
          empresa_id: string
          horario_reserva: string
          id: string
          mesa_id: string | null
          nome_cliente: string
          numero_pessoas: number
          observacoes: string | null
          status: string
          telefone_cliente: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_reserva: string
          email_cliente?: string | null
          empresa_id: string
          horario_reserva: string
          id?: string
          mesa_id?: string | null
          nome_cliente: string
          numero_pessoas?: number
          observacoes?: string | null
          status?: string
          telefone_cliente?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_reserva?: string
          email_cliente?: string | null
          empresa_id?: string
          horario_reserva?: string
          id?: string
          mesa_id?: string | null
          nome_cliente?: string
          numero_pessoas?: number
          observacoes?: string | null
          status?: string
          telefone_cliente?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_empresa_public_info: {
        Args: { _empresa_id: string }
        Returns: {
          endereco_completo: string
          id: string
          logo_url: string
          nome_fantasia: string
        }[]
      }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _empresa_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_belongs_to_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "proprietario" | "gerente" | "garcom" | "caixa"
      comanda_status: "aberta" | "fechada" | "cancelada"
      delivery_status:
        | "pendente"
        | "confirmado"
        | "em_preparo"
        | "saiu_entrega"
        | "entregue"
        | "cancelado"
      forma_pagamento: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito"
      mesa_status: "disponivel" | "ocupada" | "reservada" | "juncao"
      pedido_status:
        | "pendente"
        | "preparando"
        | "pronto"
        | "entregue"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["proprietario", "gerente", "garcom", "caixa"],
      comanda_status: ["aberta", "fechada", "cancelada"],
      delivery_status: [
        "pendente",
        "confirmado",
        "em_preparo",
        "saiu_entrega",
        "entregue",
        "cancelado",
      ],
      forma_pagamento: ["dinheiro", "pix", "cartao_credito", "cartao_debito"],
      mesa_status: ["disponivel", "ocupada", "reservada", "juncao"],
      pedido_status: [
        "pendente",
        "preparando",
        "pronto",
        "entregue",
        "cancelado",
      ],
    },
  },
} as const
