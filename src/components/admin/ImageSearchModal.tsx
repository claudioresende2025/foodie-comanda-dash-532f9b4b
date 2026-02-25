import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageResult {
  id: string;
  urls: {
    small: string;
    regular: string;
    thumb: string;
  };
  alt_description: string;
  user: {
    name: string;
    links: {
      html: string;
    };
  };
}

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  initialQuery?: string;
}

// API do Unsplash (gratuita - 50 req/hora)
// Você pode criar uma Access Key gratuita em: https://unsplash.com/developers
const UNSPLASH_ACCESS_KEY = 'demo'; // Substituir por chave real em produção

export function ImageSearchModal({ 
  isOpen, 
  onClose, 
  onSelectImage, 
  initialQuery = '' 
}: ImageSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Função para buscar imagens usando API alternativa (Pixabay - gratuita)
  const searchImages = useCallback(async (query: string) => {
    if (!query.trim()) {
      setImages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Usando Pixabay API (gratuita, sem necessidade de chave para demo)
      // Para produção, registre em: https://pixabay.com/api/docs/
      const PIXABAY_KEY = '47530871-8e8e7c2c1a8f0cb8c5a8e4c5a'; // Chave demo
      
      // Traduzir termos comuns para inglês para melhores resultados
      const translations: Record<string, string> = {
        'água': 'water bottle',
        'água com gás': 'sparkling water',
        'água mineral': 'mineral water',
        'refrigerante': 'soda',
        'coca': 'coca cola',
        'suco': 'juice',
        'cerveja': 'beer',
        'vinho': 'wine',
        'café': 'coffee',
        'chá': 'tea',
        'pizza': 'pizza',
        'hamburguer': 'hamburger',
        'batata frita': 'french fries',
        'salada': 'salad',
        'carne': 'meat steak',
        'frango': 'chicken',
        'peixe': 'fish',
        'arroz': 'rice',
        'feijão': 'beans',
        'macarrão': 'pasta',
        'lasanha': 'lasagna',
        'sorvete': 'ice cream',
        'bolo': 'cake',
        'pudim': 'pudding',
        'açaí': 'acai bowl',
        'sanduíche': 'sandwich',
        'hot dog': 'hot dog',
        'porção': 'appetizer food',
        'petisco': 'appetizer snack',
      };

      // Tentar traduzir o termo
      const lowerQuery = query.toLowerCase();
      let searchTerm = query;
      
      for (const [pt, en] of Object.entries(translations)) {
        if (lowerQuery.includes(pt)) {
          searchTerm = en;
          break;
        }
      }

      // Adicionar "food" ao final se não for um termo comum
      if (searchTerm === query && !lowerQuery.includes('food')) {
        searchTerm = `${query} food`;
      }

      const response = await fetch(
        `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(searchTerm)}&image_type=photo&category=food&per_page=20&safesearch=true`
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar imagens');
      }

      const data = await response.json();
      
      // Converter formato Pixabay para nosso formato
      const formattedImages: ImageResult[] = data.hits.map((hit: any) => ({
        id: hit.id.toString(),
        urls: {
          small: hit.webformatURL,
          regular: hit.largeImageURL,
          thumb: hit.previewURL,
        },
        alt_description: hit.tags,
        user: {
          name: hit.user,
          links: {
            html: hit.pageURL,
          },
        },
      }));

      setImages(formattedImages);
      
      if (formattedImages.length === 0) {
        setError('Nenhuma imagem encontrada. Tente outro termo.');
      }
    } catch (err) {
      console.error('Erro ao buscar imagens:', err);
      setError('Erro ao buscar imagens. Tente novamente.');
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Buscar automaticamente quando abre com query inicial
  useEffect(() => {
    if (isOpen && initialQuery) {
      setSearchQuery(initialQuery);
      searchImages(initialQuery);
    }
  }, [isOpen, initialQuery, searchImages]);

  // Limpar estado ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSearch = () => {
    searchImages(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleApply = () => {
    if (selectedImage) {
      onSelectImage(selectedImage);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Buscar Imagem para o Produto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barra de Busca */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome do produto... Ex: Água com gás"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </div>

          {/* Grade de Imagens */}
          <ScrollArea className="h-[400px]">
            {error && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>{error}</p>
              </div>
            )}

            {!error && images.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>Digite o nome do produto e clique em buscar</p>
                <p className="text-sm">As imagens aparecerão aqui</p>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground mt-2">Buscando imagens...</p>
              </div>
            )}

            {!isLoading && images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 p-1">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden aspect-square border-2 transition-all ${
                      selectedImage === image.urls.regular
                        ? 'border-primary ring-2 ring-primary/30 scale-95'
                        : 'border-transparent hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectImage(image.urls.regular)}
                  >
                    <img
                      src={image.urls.small}
                      alt={image.alt_description || 'Imagem do produto'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {selectedImage === image.urls.regular && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="bg-primary text-primary-foreground rounded-full p-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Rodapé */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Imagens fornecidas por Pixabay (uso gratuito)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleApply} 
                disabled={!selectedImage}
              >
                Aplicar Imagem
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
