import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProdutoExtraido {
  nome: string;
  descricao: string;
  preco: number;
}

interface ScanMenuRequest {
  image: string; // Base64 encoded image
}

interface ScanMenuResponse {
  produtos: ProdutoExtraido[];
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SCAN-MENU] ${step}${detailsStr}`);
};

// Prompt do sistema para o modelo de visão
const SYSTEM_PROMPT = `Você é um especialista em leitura de cardápios de restaurantes brasileiros.

Sua tarefa é analisar a imagem de um cardápio e extrair TODOS os produtos visíveis.

REGRAS ABSOLUTAS - VIOLAÇÃO = RESULTADO INVÁLIDO:

NOMES:
1. Copie o nome do produto CARACTERE POR CARACTERE como está escrito no cardápio. NÃO traduza, NÃO reformule, NÃO abrevie, NÃO mude maiúsculas/minúsculas.
2. Se está escrito "X-Burguer" no cardápio, escreva "X-Burguer" — NUNCA "Hambúrguer", "Cheeseburger" ou qualquer sinônimo.
3. Mantenha acentos, hífens e caracteres especiais EXATAMENTE como aparecem.

PREÇOS - REGRA MAIS IMPORTANTE:
4. Cada produto tem um preço INDIVIDUAL que aparece ao lado ou abaixo dele no cardápio. LEIA o preço específico de CADA item.
5. NUNCA copie o preço de um produto para outro. Se "Pizza Margherita" custa R$45,90 e "Pizza Calabresa" custa R$42,00, os preços são DIFERENTES.
6. Se NÃO CONSEGUIR LER o preço de um item específico, use 0. É melhor usar 0 do que copiar o preço errado de outro item.
7. Converta "R$ 25,90" para 25.90, "R$30" para 30.00, "25,00" para 25.00.

DESCRIÇÃO:
8. Extraia ingredientes/acompanhamentos se listados abaixo do nome. Se não houver, use "".

ESTRUTURA:
9. Leia o cardápio seção por seção, linha por linha, da esquerda para a direita, de cima para baixo.
10. Se o cardápio tem colunas, leia cada coluna separadamente.
11. Se um produto tem tamanhos (P/M/G), crie UMA entrada com o MENOR preço.
12. Ignore títulos de seção, logotipos, telefones, endereços.
13. NUNCA invente produtos ou preços que não existam na imagem.

Responda APENAS com JSON válido:
{
  "produtos": [
    { "nome": "Nome Exato do Produto", "descricao": "Descrição se houver", "preco": 25.90 }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Iniciando processamento de scan de cardápio");

    // Obter a chave do Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      logStep("Erro: LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração de API ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse do corpo da requisição
    const body: ScanMenuRequest = await req.json();
    const { image } = body;

    if (!image) {
      return new Response(
        JSON.stringify({ error: "Imagem não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Imagem recebida", { 
      imageLength: image.length,
      isBase64: image.startsWith("data:image") || /^[A-Za-z0-9+/=]+$/.test(image.slice(0, 100))
    });

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    logStep("Enviando para Lovable AI Gateway (Gemini 2.5 Pro)");

    // Chamada para a API usando o modelo google/gemini-2.5-pro via Lovable AI Gateway (melhor para visão)
    const apiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`
                }
              },
              {
                type: "text",
                text: "Analise este cardápio e extraia TODOS os produtos com nome EXATO, descrição e preço INDIVIDUAL de cada item. Responda apenas com o JSON."
              }
            ]
          }
        ],
        max_tokens: 16384,
        temperature: 0.1
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      logStep("Erro na API de IA", { status: apiResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem com IA", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiResult = await apiResponse.json();
    logStep("Resposta recebida da API", { 
      hasChoices: !!apiResult.choices,
      choicesCount: apiResult.choices?.length 
    });

    // Extrair produtos da resposta
    let produtos: ProdutoExtraido[] = [];

    if (apiResult.choices && apiResult.choices.length > 0) {
      const choice = apiResult.choices[0];
      
      if (choice.message?.content) {
        logStep("Extraindo produtos do conteúdo");
        try {
          const content = choice.message.content;
          // Tentar encontrar JSON no conteúdo
          const jsonMatch = content.match(/\{[\s\S]*"produtos"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.produtos && Array.isArray(parsed.produtos)) {
              produtos = parsed.produtos.map((p: ProdutoExtraido) => ({
                nome: String(p.nome || "").trim(),
                descricao: String(p.descricao || "").trim(),
                preco: typeof p.preco === "number" ? p.preco : parseFloat(String(p.preco)) || 0
              }));
            }
          }
        } catch (contentError) {
          logStep("Erro ao parsear JSON do conteúdo", { error: String(contentError) });
        }
      }
    }

    // Filtrar produtos inválidos (sem nome)
    produtos = produtos.filter(p => p.nome && p.nome.length > 0);

    logStep("Produtos extraídos", { count: produtos.length });

    const response: ScanMenuResponse = { produtos };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    logStep("Erro inesperado", { error: String(error) });
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar cardápio", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
