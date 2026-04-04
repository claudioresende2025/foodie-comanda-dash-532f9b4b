import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dicionário de tradução PT -> EN para termos de comida (ordenado por tamanho decrescente para match mais específico primeiro)
const foodTranslations: [string, string][] = [
  // Termos compostos primeiro (mais específicos)
  ['batata frita com bacon', 'french fries bacon'],
  ['batata frita com cheddar', 'french fries cheese'],
  ['batata frita', 'french fries'],
  ['água com gás', 'sparkling water'],
  ['coca cola', 'cola soda'],
  ['coca-cola', 'cola soda'],
  ['cachorro quente', 'hotdog'],
  ['pão de queijo', 'cheese bread brazilian'],
  ['milk shake', 'milkshake'],
  ['hot dog', 'hotdog'],
  ['x-burguer', 'cheeseburger'],
  ['x burger', 'cheeseburger'],
  ['x-salada', 'burger salad'],
  ['x-bacon', 'bacon burger'],
  ['x-tudo', 'loaded burger'],
  // Termos simples
  ['água', 'water bottle'],
  ['refrigerante', 'soda cola'],
  ['guaraná', 'guarana soda'],
  ['suco', 'juice'],
  ['cerveja', 'beer'],
  ['vinho', 'wine'],
  ['café', 'coffee'],
  ['cappuccino', 'cappuccino'],
  ['pizza', 'pizza'],
  ['hamburguer', 'hamburger'],
  ['hamburger', 'hamburger'],
  ['batata', 'french fries'],
  ['bacon', 'bacon'],
  ['cheddar', 'cheddar cheese'],
  ['queijo', 'cheese'],
  ['salada', 'salad'],
  ['carne', 'beef steak'],
  ['picanha', 'picanha steak'],
  ['filé', 'filet steak'],
  ['frango', 'chicken'],
  ['peixe', 'fish'],
  ['salmão', 'salmon'],
  ['camarão', 'shrimp'],
  ['arroz', 'rice'],
  ['feijão', 'beans'],
  ['macarrão', 'pasta'],
  ['lasanha', 'lasagna'],
  ['sorvete', 'ice cream'],
  ['bolo', 'cake'],
  ['pudim', 'pudding'],
  ['torta', 'pie'],
  ['sanduíche', 'sandwich'],
  ['lanche', 'burger'],
  ['porção', 'appetizer'],
  ['entrada', 'appetizer'],
  ['sobremesa', 'dessert'],
  ['bebida', 'drink'],
  ['açaí', 'acai bowl'],
  ['milkshake', 'milkshake'],
  ['pastel', 'fried pastry'],
  ['coxinha', 'coxinha brazilian'],
  ['tapioca', 'tapioca'],
  ['churrasco', 'bbq meat'],
  ['costela', 'ribs'],
  ['linguiça', 'sausage'],
  ['ovo', 'egg'],
  ['omelete', 'omelette'],
  ['nuggets', 'chicken nuggets'],
  ['onion rings', 'onion rings'],
  ['anéis de cebola', 'onion rings'],
  ['molho', 'sauce'],
  ['maionese', 'mayonnaise'],
  ['ketchup', 'ketchup'],
  ['mostarda', 'mustard'],
];

// Traduzir termo de busca - mantém o original e adiciona tradução
function translateQuery(query: string): string {
  const lowerQuery = query.toLowerCase().trim();
  const translations: string[] = [];
  let remainingQuery = lowerQuery;
  
  // Procura por matches do mais específico ao menos específico
  for (const [pt, en] of foodTranslations) {
    if (remainingQuery.includes(pt)) {
      translations.push(en);
      // Remove o termo encontrado para não duplicar
      remainingQuery = remainingQuery.replace(pt, ' ').trim();
    }
  }
  
  if (translations.length > 0) {
    // Combina termo original + traduções para melhor resultado
    const result = `${query} ${translations.join(' ')}`;
    console.log(`[TRANSLATE] "${query}" -> "${result}"`);
    return result;
  }
  
  // Se não encontrou tradução, usa o termo original
  console.log(`[TRANSLATE] "${query}" -> "${query}" (sem tradução)`);
  return query;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      throw new Error("Query é obrigatória");
    }

    console.log(`[SEARCH-PRODUCT-IMAGES] Buscando imagens para: ${query}`);

    const searchTerm = translateQuery(query);
    console.log(`[SEARCH-PRODUCT-IMAGES] Termo traduzido: ${searchTerm}`);

    // Tentar Pexels API primeiro
    const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
    
    if (PEXELS_API_KEY) {
      console.log("[SEARCH-PRODUCT-IMAGES] Usando Pexels API");
      
      // Buscar até 20 imagens
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=20`,
        {
          headers: {
            Authorization: PEXELS_API_KEY,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        const results = (data.photos || []).map((photo: any) => ({
          id: photo.id.toString(),
          urls: {
            small: photo.src.medium,
            regular: photo.src.large,
            thumb: photo.src.small,
          },
          alt_description: photo.alt || `${query} - Imagem`,
          user: {
            name: photo.photographer,
            links: { html: photo.photographer_url },
          },
        }));

        console.log(`[SEARCH-PRODUCT-IMAGES] Pexels: ${results.length} imagens encontradas`);

        return new Response(JSON.stringify({ results, source: 'pexels' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Tentar Unsplash API
    const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
    
    if (UNSPLASH_ACCESS_KEY) {
      console.log("[SEARCH-PRODUCT-IMAGES] Usando Unsplash API");
      
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=20`,
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        const results = (data.results || []).map((photo: any) => ({
          id: photo.id,
          urls: {
            small: photo.urls.small,
            regular: photo.urls.regular,
            thumb: photo.urls.thumb,
          },
          alt_description: photo.alt_description || 'Imagem do produto',
          user: {
            name: photo.user.name,
            links: { html: photo.user.links.html },
          },
        }));

        console.log(`[SEARCH-PRODUCT-IMAGES] Unsplash: ${results.length} imagens encontradas`);

        return new Response(JSON.stringify({ results, source: 'unsplash' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Fallback: usar Lorem Picsum (funciona sempre, sem API key)
    console.log("[SEARCH-PRODUCT-IMAGES] Usando Lorem Picsum (fallback)");
    
    // Gerar seed baseado no termo de busca para resultados consistentes
    const hashCode = (s: string) => s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const baseSeed = Math.abs(hashCode(searchTerm));
    
    const picusumImages = Array.from({ length: 20 }, (_, i) => {
      const seed = baseSeed + i;
      const size = 400;
      
      return {
        id: `picsum-${seed}`,
        urls: {
          small: `https://picsum.photos/seed/${seed}/${size}/${size}`,
          regular: `https://picsum.photos/seed/${seed}/800/800`,
          thumb: `https://picsum.photos/seed/${seed}/150/150`,
        },
        alt_description: `${query} - Imagem ${i + 1}`,
        user: {
          name: "Lorem Picsum",
          links: { html: "https://picsum.photos" },
        },
      };
    });

    return new Response(JSON.stringify({ 
      results: picusumImages, 
      source: 'picsum',
      message: 'Configure PEXELS_API_KEY ou UNSPLASH_ACCESS_KEY para imagens de comida reais'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[SEARCH-PRODUCT-IMAGES] Erro:", errorMessage);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
