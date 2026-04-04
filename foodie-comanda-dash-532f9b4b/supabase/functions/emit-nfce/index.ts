import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NfceItem {
  nome: string;
  ncm: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface NfceRequest {
  empresa_id: string;
  itens: NfceItem[];
  valor_total: number;
  forma_pagamento: string;
  comanda_id?: string;
  pedido_delivery_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: NfceRequest = await req.json();
    const { empresa_id, itens, valor_total, forma_pagamento, comanda_id, pedido_delivery_id } = body;

    if (!empresa_id || !itens || itens.length === 0) {
      return new Response(
        JSON.stringify({ error: "empresa_id e itens são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client to read config_fiscal
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch fiscal config
    const { data: config, error: configError } = await adminClient
      .from("config_fiscal")
      .select("*")
      .eq("empresa_id", empresa_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração fiscal não encontrada. Configure na página Empresa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.api_token_nfe) {
      return new Response(
        JSON.stringify({ error: "Token da API Focus NFe não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch empresa data
    const { data: empresa } = await adminClient
      .from("empresas")
      .select("nome_fantasia, cnpj")
      .eq("id", empresa_id)
      .single();

    // Map forma_pagamento to Focus NFe code
    const mapFormaPagamento = (fp: string): string => {
      switch (fp) {
        case "dinheiro": return "01";
        case "cartao_credito": return "03";
        case "cartao_debito": return "04";
        case "pix": return "17";
        default: return "99";
      }
    };

    // Build Focus NFe payload
    const focusPayload: Record<string, any> = {
      natureza_operacao: "VENDA",
      forma_pagamento: "0", // à vista
      tipo_documento: "1", // saída
      finalidade_emissao: "1", // normal
      consumidor_final: "1",
      presenca_comprador: "1", // presencial
      informacoes_adicionais_contribuinte: "Emitido via FoodieComanda",
      items: itens.map((item, index) => ({
        numero_item: index + 1,
        codigo_produto: String(index + 1).padStart(4, "0"),
        descricao: item.nome,
        codigo_ncm: item.ncm || "21069090",
        cfop: "5102",
        unidade_comercial: "UN",
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: item.valor_unitario.toFixed(2),
        valor_unitario_tributavel: item.valor_unitario.toFixed(2),
        unidade_tributavel: "UN",
        quantidade_tributavel: item.quantidade,
        valor_bruto: item.valor_total.toFixed(2),
        origem: "0",
        icms_situacao_tributaria: config.regime_tributario === "simples_nacional" ? "102" : "00",
        ...(config.regime_tributario === "simples_nacional"
          ? { icms_csosn: "102" }
          : { icms_aliquota: "0", icms_base_calculo: item.valor_total.toFixed(2) }),
      })),
      formas_pagamento: [
        {
          forma_pagamento: mapFormaPagamento(forma_pagamento),
          valor_pagamento: valor_total.toFixed(2),
        },
      ],
    };

    // Add CSC if configured
    if (config.csc && config.csc_id) {
      focusPayload.token_csc = config.csc;
      focusPayload.id_token_csc = config.csc_id;
    }

    // Determine endpoint
    const baseUrl = config.modo_producao
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";

    const ref = `nfce-${empresa_id.substring(0, 8)}-${Date.now()}`;

    // Send to Focus NFe
    const focusResponse = await fetch(`${baseUrl}/v2/nfce?ref=${ref}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token token=${config.api_token_nfe}`,
      },
      body: JSON.stringify(focusPayload),
    });

    const focusResult = await focusResponse.json();

    // Determine status
    let status = "erro";
    let danfe_url = null;
    let xml_url = null;
    let chave_acesso = null;
    let numero_nota = null;
    let serie = null;
    let erro_sefaz = null;

    if (focusResponse.ok || focusResult.status === "autorizado" || focusResult.status_sefaz === "100") {
      status = "autorizada";
      danfe_url = focusResult.caminho_danfe || focusResult.url_danfe || null;
      xml_url = focusResult.caminho_xml || focusResult.url_xml || null;
      chave_acesso = focusResult.chave_nfe || focusResult.chave || null;
      numero_nota = focusResult.numero || null;
      serie = focusResult.serie || null;
    } else if (focusResult.status === "processando_autorizacao") {
      status = "processando";
    } else {
      erro_sefaz = focusResult.mensagem_sefaz || focusResult.mensagem || focusResult.erros?.join("; ") || JSON.stringify(focusResult);
    }

    // Save to notas_fiscais
    const { error: insertError } = await adminClient.from("notas_fiscais").insert({
      empresa_id,
      comanda_id: comanda_id || null,
      pedido_delivery_id: pedido_delivery_id || null,
      numero_nota,
      serie,
      chave_acesso,
      status,
      danfe_url,
      xml_url,
      valor_total,
      erro_sefaz,
      api_response: focusResult,
    });

    if (insertError) {
      console.error("Erro ao salvar nota fiscal:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: status === "autorizada",
        status,
        danfe_url,
        xml_url,
        chave_acesso,
        numero_nota,
        erro_sefaz,
        ref,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro na emissão NFC-e:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao emitir NFC-e" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
