Initialising login role...
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_eventos: {
        Row: {
          created_at: string | null
          dados: Json | null
          empresa_id: string | null
          id: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string | null
          dados?: Json | null
          empresa_id?: string | null
          id?: string
          tipo_evento: string
        }
        Update: {
          created_at?: string | null
          dados?: Json | null
          empresa_id?: string | null
          id?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
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
        ]
      }
      caixas: {
        Row: {
          created_at: string
          data_abertura: string
          data_fechamento: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          status: string
          usuario_id: string | null
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          status: string
          usuario_id?: string | null
          valor_abertura: number
          valor_fechamento?: number | null
        }
        Update: {
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          usuario_id?: string | null
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
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
          mesa_id: string | null
          status: string
        }
        Insert: {
          atendida_at?: string | null
          comanda_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          mesa_id?: string | null
          status: string
        }
        Update: {
          atendida_at?: string | null
          comanda_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          mesa_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mesa"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversas: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          status: string | null
          ultima_mensagem: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          status?: string | null
          ultima_mensagem?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          status?: string | null
          ultima_mensagem?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagens: {
        Row: {
          conversa_id: string
          created_at: string | null
          id: string
          lida: boolean | null
          mensagem: string
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          conversa_id: string
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          conversa_id?: string
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "chat_conversas"
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
          forma_pagamento: string | null
          id: string
          mesa_id: string | null
          nome_cliente: string | null
          qr_code_sessao: string | null
          status: string
          telefone_cliente: string | null
          total: number | null
          troco_para: number | null
          updated_at: string | null
        }
        Insert: {
          comanda_mestre_id?: string | null
          created_at?: string
          data_fechamento?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          mesa_id?: string | null
          nome_cliente?: string | null
          qr_code_sessao?: string | null
          status?: string
          telefone_cliente?: string | null
          total?: number | null
          troco_para?: number | null
          updated_at?: string | null
        }
        Update: {
          comanda_mestre_id?: string | null
          created_at?: string
          data_fechamento?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          mesa_id?: string | null
          nome_cliente?: string | null
          qr_code_sessao?: string | null
          status?: string
          telefone_cliente?: string | null
          total?: number | null
          troco_para?: number | null
          updated_at?: string | null
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
          aceita_pix: boolean | null
          ativo: boolean | null
          created_at: string
          delivery_ativo: boolean
          dias_funcionamento: number[] | null
          empresa_id: string
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          pedido_minimo: number | null
          raio_entrega_km: number | null
          taxa_entrega: number | null
          tempo_estimado_max: number | null
          tempo_estimado_min: number | null
          updated_at: string | null
          valor_minimo_pedido: number | null
        }
        Insert: {
          aceita_pix?: boolean | null
          ativo?: boolean | null
          created_at?: string
          delivery_ativo?: boolean
          dias_funcionamento?: number[] | null
          empresa_id: string
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          pedido_minimo?: number | null
          raio_entrega_km?: number | null
          taxa_entrega?: number | null
          tempo_estimado_max?: number | null
          tempo_estimado_min?: number | null
          updated_at?: string | null
          valor_minimo_pedido?: number | null
        }
        Update: {
          aceita_pix?: boolean | null
          ativo?: boolean | null
          created_at?: string
          delivery_ativo?: boolean
          dias_funcionamento?: number[] | null
          empresa_id?: string
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          pedido_minimo?: number | null
          raio_entrega_km?: number | null
          taxa_entrega?: number | null
          tempo_estimado_max?: number | null
          tempo_estimado_min?: number | null
          updated_at?: string | null
          valor_minimo_pedido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_empresa"
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
          created_at: string | null
          data_expiracao: string | null
          empresa_id: string | null
          id: string
          tipo: string
          uso_atual: number | null
          uso_maximo: number | null
          valor: number
          valor_minimo: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          data_expiracao?: string | null
          empresa_id?: string | null
          id?: string
          tipo: string
          uso_atual?: number | null
          uso_maximo?: number | null
          valor: number
          valor_minimo?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          data_expiracao?: string | null
          empresa_id?: string | null
          id?: string
          tipo?: string
          uso_atual?: number | null
          uso_maximo?: number | null
          valor?: number
          valor_minimo?: number | null
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
      delivery_tracking: {
        Row: {
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacao: string | null
          pedido_delivery_id: string
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          pedido_delivery_id: string
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          pedido_delivery_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_pedido_delivery_id_fkey"
            columns: ["pedido_delivery_id"]
            isOneToOne: false
            referencedRelation: "pedidos_delivery"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean | null
          chave_pix: string | null
          cnpj: string | null
          created_at: string
          endereco_completo: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          nome_fantasia: string
          slug: string | null
          updated_at: string
          usuario_id: string | null
          usuario_proprietario_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          chave_pix?: string | null
          cnpj?: string | null
          created_at?: string
          endereco_completo?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome_fantasia: string
          slug?: string | null
          updated_at?: string
          usuario_id?: string | null
          usuario_proprietario_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          chave_pix?: string | null
          cnpj?: string | null
          created_at?: string
          endereco_completo?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome_fantasia?: string
          slug?: string | null
          updated_at?: string
          usuario_id?: string | null
          usuario_proprietario_id?: string | null
        }
        Relationships: []
      }
      enderecos_cliente: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string | null
          complemento: string | null
          created_at: string | null
          estado: string | null
          id: string
          is_default: boolean | null
          nome_cliente: string
          numero: string
          referencia: string | null
          rua: string
          telefone: string
          user_id: string | null
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          is_default?: boolean | null
          nome_cliente: string
          numero: string
          referencia?: string | null
          rua: string
          telefone: string
          user_id?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          is_default?: boolean | null
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
          created_at: string | null
          empresa_id: string | null
          historico: Json | null
          id: string
          pontos: number | null
          pontos_atuais: number | null
          saldo: number | null
          telefone_cliente: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          historico?: Json | null
          id?: string
          pontos?: number | null
          pontos_atuais?: number | null
          saldo?: number | null
          telefone_cliente: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          historico?: Json | null
          id?: string
          pontos?: number | null
          pontos_atuais?: number | null
          saldo?: number | null
          telefone_cliente?: string
          updated_at?: string | null
          user_id?: string | null
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
      itens_delivery: {
        Row: {
          created_at: string | null
          id: string
          nome_produto: string
          notas: string | null
          pedido_delivery_id: string | null
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_produto: string
          notas?: string | null
          pedido_delivery_id?: string | null
          preco_unitario: number
          produto_id?: string | null
          quantidade: number
          subtotal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_produto?: string
          notas?: string | null
          pedido_delivery_id?: string | null
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
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
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
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
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
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          pedido_delivery_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_caixa"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_push: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          lida: boolean | null
          mensagem: string
          tipo: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          lida?: boolean | null
          mensagem: string
          tipo?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          tipo?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          comanda_id: string
          created_at: string
          id: string
          notas_cliente: string | null
          preco_unitario: number
          produto_id: string
          quantidade: number
          status_cozinha: Database["public"]["Enums"]["pedido_status"]
          subtotal: number
          updated_at: string | null
        }
        Insert: {
          comanda_id: string
          created_at?: string
          id?: string
          notas_cliente?: string | null
          preco_unitario: number
          produto_id: string
          quantidade: number
          status_cozinha?: Database["public"]["Enums"]["pedido_status"]
          subtotal: number
          updated_at?: string | null
        }
        Update: {
          comanda_id?: string
          created_at?: string
          id?: string
          notas_cliente?: string | null
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          status_cozinha?: Database["public"]["Enums"]["pedido_status"]
          subtotal?: number
          updated_at?: string | null
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
          created_at: string | null
          cupom_id: string | null
          desconto: number | null
          empresa_id: string | null
          endereco_id: string | null
          forma_pagamento: string | null
          id: string
          notas: string | null
          status: string | null
          stripe_payment_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_status: string | null
          subtotal: number | null
          taxa_entrega: number | null
          tempo_estimado: string | null
          total: number | null
          troco_para: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agendado_para?: string | null
          created_at?: string | null
          cupom_id?: string | null
          desconto?: number | null
          empresa_id?: string | null
          endereco_id?: string | null
          forma_pagamento?: string | null
          id?: string
          notas?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          subtotal?: number | null
          taxa_entrega?: number | null
          tempo_estimado?: string | null
          total?: number | null
          troco_para?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agendado_para?: string | null
          created_at?: string | null
          cupom_id?: string | null
          desconto?: number | null
          empresa_id?: string | null
          endereco_id?: string | null
          forma_pagamento?: string | null
          id?: string
          notas?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          subtotal?: number | null
          taxa_entrega?: number | null
          tempo_estimado?: string | null
          total?: number | null
          troco_para?: number | null
          updated_at?: string | null
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
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          nome: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          role?: string | null
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
      promocoes: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          tipo: string
          valor_desconto: number
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          tipo: string
          valor_desconto: number
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string
          valor_desconto?: number
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
      relatorio_clientes_inativos: {
        Row: {
          created_at: string | null
          dias_inativo: number | null
          empresa_id: string
          id: string
          total_gasto: number | null
          ultima_compra: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dias_inativo?: number | null
          empresa_id: string
          id?: string
          total_gasto?: number | null
          ultima_compra?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dias_inativo?: number | null
          empresa_id?: string
          id?: string
          total_gasto?: number | null
          ultima_compra?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_clientes_inativos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_fidelidade_clientes: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          pontos_gastos: number | null
          total_pedidos: number | null
          total_pontos: number | null
          user_id: string | null
          valor_total_gasto: number | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          pontos_gastos?: number | null
          total_pedidos?: number | null
          total_pontos?: number | null
          user_id?: string | null
          valor_total_gasto?: number | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          pontos_gastos?: number | null
          total_pedidos?: number | null
          total_pontos?: number | null
          user_id?: string | null
          valor_total_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_fidelidade_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_horarios_pico: {
        Row: {
          created_at: string | null
          dia_semana: number
          empresa_id: string
          hora: number
          id: string
          quantidade_pedidos: number | null
          receita: number | null
        }
        Insert: {
          created_at?: string | null
          dia_semana: number
          empresa_id: string
          hora: number
          id?: string
          quantidade_pedidos?: number | null
          receita?: number | null
        }
        Update: {
          created_at?: string | null
          dia_semana?: number
          empresa_id?: string
          hora?: number
          id?: string
          quantidade_pedidos?: number | null
          receita?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_horarios_pico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_produtos_vendidos: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          nome_produto: string
          periodo_fim: string
          periodo_inicio: string
          produto_id: string | null
          quantidade_vendida: number | null
          receita_total: number | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          nome_produto: string
          periodo_fim: string
          periodo_inicio: string
          produto_id?: string | null
          quantidade_vendida?: number | null
          receita_total?: number | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          nome_produto?: string
          periodo_fim?: string
          periodo_inicio?: string
          produto_id?: string | null
          quantidade_vendida?: number | null
          receita_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_produtos_vendidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_produtos_vendidos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_vendas_diarias: {
        Row: {
          created_at: string | null
          data: string
          empresa_id: string
          id: string
          ticket_medio: number | null
          total_delivery: number | null
          total_pedidos: number | null
          total_presencial: number | null
          total_vendas: number | null
        }
        Insert: {
          created_at?: string | null
          data: string
          empresa_id: string
          id?: string
          ticket_medio?: number | null
          total_delivery?: number | null
          total_pedidos?: number | null
          total_presencial?: number | null
          total_vendas?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string
          empresa_id?: string
          id?: string
          ticket_medio?: number | null
          total_delivery?: number | null
          total_pedidos?: number | null
          total_presencial?: number | null
          total_vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_vendas_diarias_empresa_id_fkey"
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
          updated_at: string | null
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
          numero_pessoas: number
          observacoes?: string | null
          status?: string
          telefone_cliente?: string | null
          updated_at?: string | null
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
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mesa"
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
      abrir_comanda_e_ocupar_mesa:
        | {
            Args: {
              p_empresa_id: string
              p_items: Json
              p_mesa_id: string
              p_qr_code_sessao: string
            }
            Returns: string
          }
        | {
            Args: {
              p_empresa_id: string
              p_mesa_id: string
              p_qr_code_sessao: string
            }
            Returns: string
          }
      debitar_pontos_fidelidade: {
        Args: { qtd_pontos: number; userid: string }
        Returns: undefined
      }
      gerar_pix: {
        Args: { p_comanda_id: string; p_empresa_id: string; p_valor: number }
        Returns: Json
      }
      get_empresa_public_info: {
        Args: { _empresa_id: string }
        Returns: {
          endereco_completo: string
          id: string
          logo_url: string
          nome_fantasia: string
        }[]
      }
      get_empresa_publico: {
        Args: { p_empresa_id: string }
        Returns: {
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
      mesa_status: "disponivel" | "ocupada" | "reservada" | "juncao"
      payment_method: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito"
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
  graphql_public: {
    Enums: {},
  },
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
      mesa_status: ["disponivel", "ocupada", "reservada", "juncao"],
      payment_method: ["dinheiro", "pix", "cartao_credito", "cartao_debito"],
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
