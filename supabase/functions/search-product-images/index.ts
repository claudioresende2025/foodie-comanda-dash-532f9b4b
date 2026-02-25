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
      // Fallback: usar foodish API (específica para comida) + Unsplash Source
      console.log("[SEARCH-PRODUCT-IMAGES] UNSPLASH_ACCESS_KEY não configurada, usando fallback");
      
      // Traduzir para inglês e criar lista de keywords de comida
      const foodKeywords = [
        'burger', 'pizza', 'pasta', 'salad', 'steak', 'sushi', 'tacos',
        'sandwich', 'soup', 'chicken', 'fish', 'rice', 'dessert', 'coffee',
        'juice', 'beer', 'wine', 'cake', 'ice-cream', 'breakfast'
      ];
      
      // Usar Unsplash Source (não requer API key)
      const searchTerm = query.toLowerCase().replace(/\s+/g, '-');
      const placeholderImages = Array.from({ length: 16 }, (_, i) => {
        // Usar diferentes seeds para variar as imagens
        const seed = `${searchTerm}-${i}-food`;
        return {
          id: `placeholder-${i}`,
          urls: {
            small: `https://source.unsplash.com/300x300/?${encodeURIComponent(searchTerm)},food&sig=${i}`,
            regular: `https://source.unsplash.com/800x800/?${encodeURIComponent(searchTerm)},food&sig=${i}`,
            thumb: `https://source.unsplash.com/150x150/?${encodeURIComponent(searchTerm)},food&sig=${i}`,
          },
          alt_description: `Imagem ${i + 1} para ${query}`,
          user: {
            name: "Unsplash",
            links: { html: "https://unsplash.com" },
          },
        };
      });

      return new Response(JSON.stringify({ results: placeholderImages, source: 'unsplash-source' }), {
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
