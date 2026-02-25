import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Usar Unsplash API
    const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
    
    if (!UNSPLASH_ACCESS_KEY) {
      // Fallback: usar Lorem Picsum (funciona sempre, sem API key)
      console.log("[SEARCH-PRODUCT-IMAGES] UNSPLASH_ACCESS_KEY não configurada, usando Lorem Picsum");
      
      // IDs de imagens de comida do Picsum (curadas manualmente)
      const foodPicsumIds = [
        1060, // fruit
        292,  // berries
        429,  // food
        493,  // pizza/bread
        999,  // coffee
        824,  // vegetables
        36,   // food/plants
        225,  // nature/fruit
        326,  // bread
        488,  // food
        674,  // berries
        835,  // wine
        42,   // nature
        102,  // meal
        139,  // food
        312,  // food
      ];
      
      // Usar Lorem Picsum com IDs específicos para imagens de qualidade
      const searchTerm = query.toLowerCase();
      const placeholderImages = foodPicsumIds.map((id, i) => {
        // Usar seed baseado na busca para ter variedade por termo
        const seedHash = searchTerm.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const adjustedId = foodPicsumIds[(i + seedHash) % foodPicsumIds.length];
        
        return {
          id: `picsum-${i}-${adjustedId}`,
          urls: {
            small: `https://picsum.photos/id/${adjustedId}/300/300`,
            regular: `https://picsum.photos/id/${adjustedId}/800/800`,
            thumb: `https://picsum.photos/id/${adjustedId}/150/150`,
          },
          alt_description: `Imagem ${i + 1} para ${query}`,
          user: {
            name: "Lorem Picsum",
            links: { html: "https://picsum.photos" },
          },
        };
      });

      return new Response(JSON.stringify({ results: placeholderImages, source: 'lorem-picsum' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Traduzir termos comuns para inglês
    const translations: Record<string, string> = {
      'água': 'water bottle',
      'água com gás': 'sparkling water',
      'refrigerante': 'soda drink',
      'coca cola': 'cola drink',
      'suco': 'fruit juice',
      'cerveja': 'beer',
      'vinho': 'wine',
      'café': 'coffee cup',
      'pizza': 'pizza',
      'hamburguer': 'hamburger',
      'batata frita': 'french fries',
      'salada': 'salad',
      'carne': 'steak',
      'frango': 'chicken',
      'peixe': 'fish',
      'arroz': 'rice',
      'macarrão': 'pasta',
      'sorvete': 'ice cream',
      'bolo': 'cake',
      'sanduíche': 'sandwich',
    };

    let searchTerm = query.toLowerCase();
    for (const [pt, en] of Object.entries(translations)) {
      if (searchTerm.includes(pt)) {
        searchTerm = en;
        break;
      }
    }

    // Se ainda é o termo original, adicionar "food"
    if (searchTerm === query.toLowerCase() && !searchTerm.includes('food')) {
      searchTerm = `${query} food`;
    }

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=20&orientation=squarish`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[SEARCH-PRODUCT-IMAGES] Unsplash API error: ${response.status}`);
      throw new Error(`Unsplash API error: ${response.status}`);
    }

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

    console.log(`[SEARCH-PRODUCT-IMAGES] Encontradas ${results.length} imagens`);

    return new Response(JSON.stringify({ results, source: 'unsplash' }), {
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
