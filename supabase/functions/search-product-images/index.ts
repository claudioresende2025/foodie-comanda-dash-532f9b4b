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
      // Fallback: usar Unsplash Source (funciona sem API key, com busca real)
      console.log("[SEARCH-PRODUCT-IMAGES] UNSPLASH_ACCESS_KEY não configurada, usando Unsplash Source");
      
      // Traduzir termos comuns para inglês para melhor resultado
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

      // Traduzir o termo de busca
      let searchTerm = query.toLowerCase();
      let translated = false;
      
      for (const [pt, en] of Object.entries(foodTranslations)) {
        if (searchTerm.includes(pt)) {
          searchTerm = en;
          translated = true;
          break;
        }
      }
      
      // Se não foi traduzido, adicionar "food" ao termo
      if (!translated) {
        searchTerm = `${query} food dish`;
      }

      console.log(`[SEARCH-PRODUCT-IMAGES] Termo traduzido: ${searchTerm}`);

      // Gerar múltiplas imagens usando Unsplash Source com variações
      // Adiciona um timestamp/random para evitar cache e obter imagens diferentes
      const baseTime = Date.now();
      const placeholderImages = Array.from({ length: 8 }, (_, i) => {
        const uniqueSeed = baseTime + i * 1000;
        const encodedQuery = encodeURIComponent(searchTerm);
        
        return {
          id: `unsplash-source-${i}-${uniqueSeed}`,
          urls: {
            small: `https://source.unsplash.com/300x300/?${encodedQuery}&sig=${uniqueSeed}`,
            regular: `https://source.unsplash.com/800x800/?${encodedQuery}&sig=${uniqueSeed}`,
            thumb: `https://source.unsplash.com/150x150/?${encodedQuery}&sig=${uniqueSeed}`,
          },
          alt_description: `${query} - Imagem ${i + 1}`,
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
