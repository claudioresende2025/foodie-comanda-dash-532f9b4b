import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em leitura de cardápios de restaurantes. 
Analise a imagem do cardápio e extraia TODOS os produtos/itens com seus nomes, descrições e preços EXATAMENTE como aparecem.

Regras importantes:
- Extraia o nome EXATO do produto como aparece no cardápio
- Se houver descrição/ingredientes, inclua na descrição
- Extraia o preço numérico (apenas o número, sem R$). Se houver múltiplos preços (ex: tamanhos diferentes), use o MENOR preço.
- Se o preço estiver em formato "XX.XX" ou "XX,XX", converta para número decimal (ex: 27.99)
- NÃO invente produtos ou preços que não existam na imagem
- Inclua TODOS os itens visíveis, incluindo bebidas, sobremesas, acompanhamentos etc.
- Para itens sem preço visível, use 0 como preço`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este cardápio e extraia todos os produtos com nome, descrição e preço.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_produtos_cardapio",
              description: "Extrai todos os produtos do cardápio com nome, descrição e preço",
              parameters: {
                type: "object",
                properties: {
                  produtos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: {
                          type: "string",
                          description: "Nome exato do produto como aparece no cardápio",
                        },
                        descricao: {
                          type: "string",
                          description: "Descrição ou ingredientes do produto. Vazio se não houver.",
                        },
                        preco: {
                          type: "number",
                          description: "Preço do produto como número decimal (ex: 27.99). Use o menor preço se houver variações.",
                        },
                      },
                      required: ["nome", "descricao", "preco"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["produtos"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "extrair_produtos_cardapio" },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway retornou status ${response.status}`);
    }

    const result = await response.json();
    console.log("AI response:", JSON.stringify(result).slice(0, 500));

    // Extract tool call result
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("Resposta da IA não contém dados estruturados");
    }

    const produtos = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(produtos), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scan-menu error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
