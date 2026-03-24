import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  textoOriginal?: string;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SCAN-MENU] ${step}${detailsStr}`);
};

// Tool schema para extração estruturada de produtos
const extractProductsTool = {
  type: "function",
  function: {
    name: "extract_menu_products",
    description: "Extrai produtos de um cardápio, incluindo nome, descrição e preço de cada item identificado na imagem",
    parameters: {
      type: "object",
      properties: {
        produtos: {
          type: "array",
          description: "Lista de produtos extraídos do cardápio",
          items: {
            type: "object",
            properties: {
              nome: {
                type: "string",
                description: "Nome do produto exatamente como aparece no cardápio"
              },
              descricao: {
                type: "string",
                description: "Descrição do produto se houver, ou string vazia se não houver descrição"
              },
              preco: {
                type: "number",
                description: "Preço do produto em reais (número decimal). Se houver múltiplos preços (ex: tamanhos), usar o menor preço. Se não encontrar preço, usar 0"
              }
            },
            required: ["nome", "descricao", "preco"]
          }
        }
      },
      required: ["produtos"]
    }
  }
};

// Prompt do sistema para o modelo de visão
const SYSTEM_PROMPT = `Você é um especialista em leitura de cardápios de restaurantes e estabelecimentos de alimentação.

Sua tarefa é analisar a imagem de um cardápio e extrair TODOS os produtos visíveis com suas informações.

REGRAS IMPORTANTES:
1. Extraia o nome do produto EXATAMENTE como aparece no cardápio
2. Extraia a descrição se houver (ingredientes, acompanhamentos, etc). Se não houver descrição, use string vazia
3. Extraia o preço em formato numérico (ex: 25.90, não "R$ 25,90")
4. Se um produto tem múltiplos preços (tamanhos diferentes como P/M/G), extraia o MENOR preço
5. Se um produto tem preço com variações (ex: "27.99 • 30.99"), extraia TODOS os preços como produtos separados ou use o menor
6. NUNCA invente produtos ou preços - extraia SOMENTE o que está visível na imagem
7. Ignore cabeçalhos, seções, números de páginas, logos e informações que não são produtos
8. Mantenha acentos e caracteres especiais nos nomes
9. Se o preço não for identificável, use 0

Analise a imagem e extraia todos os produtos usando a ferramenta fornecida.`;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Iniciando processamento de scan de cardápio");

    // Obter a chave do Lovable AI Gateway a partir de env
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      logStep("Erro: OPENAI_API_KEY não configurada");
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

    // Preparar a imagem para a API
    // Se já tem o prefixo data:image, extrair apenas o base64
    let base64Image = image;
    let mimeType = "image/jpeg";
    
    if (image.startsWith("data:")) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Image = matches[2];
      }
    }

    logStep("Enviando para Lovable AI Gateway (Gemini 2.0 Flash)", { mimeType });

    // Chamada para a API usando google/gemini-2.0-flash-001 via Lovable AI Gateway
    // URL do Lovable Gateway: https://lovable.dev/api/chat
    const apiResponse = await fetch("https://lovable.dev/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
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
                  url: `data:${mimeType};base64,${base64Image}`
                }
              },
              {
                type: "text",
                text: "Analise este cardápio e extraia todos os produtos com nome, descrição e preço usando a ferramenta extract_menu_products."
              }
            ]
          }
        ],
        tools: [extractProductsTool],
        tool_choice: { type: "function", function: { name: "extract_menu_products" } },
        max_tokens: 4096,
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
      
      // Verificar se há tool_calls na resposta
      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.function?.name === "extract_menu_products") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            if (args.produtos && Array.isArray(args.produtos)) {
              produtos = args.produtos.map((p: ProdutoExtraido) => ({
                nome: String(p.nome || "").trim(),
                descricao: String(p.descricao || "").trim(),
                preco: typeof p.preco === "number" ? p.preco : parseFloat(String(p.preco)) || 0
              }));
            }
          } catch (parseError) {
            logStep("Erro ao parsear argumentos da tool", { error: String(parseError) });
          }
        }
      }
      // Fallback: tentar extrair do conteúdo da mensagem se não houver tool_calls
      else if (choice.message?.content) {
        logStep("Sem tool_calls, tentando extrair do conteúdo");
        try {
          // Tentar encontrar JSON no conteúdo
          const content = choice.message.content;
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
          logStep("Não foi possível extrair produtos do conteúdo", { error: String(contentError) });
        }
      }
    }

    // Filtrar produtos inválidos (sem nome ou preço zero pode ser aceitável se não tem preço visível)
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
