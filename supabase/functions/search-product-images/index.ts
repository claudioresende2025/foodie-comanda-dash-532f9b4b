import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dicionário de tradução PT -> EN para termos de comida
const foodTranslations: Record<string, string> = {
  'água': 'water bottle',
  'água com gás': 'sparkling water',
  'refrigerante': 'soda drink',
  'coca cola': 'cola drink',
  'coca-cola': 'cola drink',
  'guaraná': 'guarana soda',
  'suco': 'fruit juice',
  'cerveja': 'beer glass',
  'vinho': 'wine glass',
  'café': 'coffee cup',
  'cappuccino': 'cappuccino',
  'pizza': 'pizza food',
  'hamburguer': 'hamburger burger',
  'hamburger': 'hamburger burger',
  'batata frita': 'french fries',
  'batata': 'potato fries',
  'bacon': 'bacon strips',
  'cheddar': 'cheese cheddar',
  'salada': 'salad fresh',
  'carne': 'beef steak',
  'picanha': 'beef steak',
  'filé': 'beef filet',
  'frango': 'chicken dish',
  'peixe': 'fish dish',
  'salmão': 'salmon fish',
  'arroz': 'rice dish',
  'feijão': 'beans food',
  'macarrão': 'pasta dish',
  'lasanha': 'lasagna',
  'sorvete': 'ice cream',
  'bolo': 'cake dessert',
  'pudim': 'pudding dessert',
  'torta': 'pie dessert',
  'sanduíche': 'sandwich',
  'lanche': 'snack food',
  'porção': 'appetizer food',
  'entrada': 'appetizer',
  'sobremesa': 'dessert',
  'bebida': 'drink beverage',
  'açaí': 'acai bowl',
  'milk shake': 'milkshake',
  'milkshake': 'milkshake',
  'hot dog': 'hotdog',
  'cachorro quente': 'hotdog',
  'pastel': 'fried pastry',
  'coxinha': 'brazilian snack',
  'pão de queijo': 'cheese bread',
  'tapioca': 'tapioca crepe',
  'churrasco': 'barbecue meat',
};

// Traduzir termo de busca
function translateQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  for (const [pt, en] of Object.entries(foodTranslations)) {
    if (lowerQuery.includes(pt)) {
      return en;
    }
  }
  
  // Se não encontrou tradução, adiciona "food" ao termo
  return `${query} food`;
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
      
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=8&orientation=square`,
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
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=8&orientation=squarish`,
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
    
    const picusumImages = Array.from({ length: 8 }, (_, i) => {
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
