import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Camera, 
  Upload, 
  Loader2, 
  ScanLine, 
  Check, 
  X, 
  Trash2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { extrairProdutosDeTexto, ProdutoExtraido } from '@/utils/menuTextParser';

// Tipo estendido com imagem
export interface ProdutoComImagem extends ProdutoExtraido {
  imagemUrl?: string;
}

interface MenuScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProducts: (produtos: Array<{ nome: string; descricao: string; preco: number; imagemUrl?: string }>) => void;
}

type EtapaScanner = 'selecao' | 'camera' | 'processando' | 'revisao' | 'capturandoImagem';

export function MenuScannerModal({ isOpen, onClose, onImportProducts }: MenuScannerModalProps) {
  const [etapa, setEtapa] = useState<EtapaScanner>('selecao');
  const [imagemCapturada, setImagemCapturada] = useState<string | null>(null);
  const [progressoOCR, setProgressoOCR] = useState(0);
  const [produtosExtraidos, setProdutosExtraidos] = useState<ProdutoComImagem[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Estado para captura de imagem de produto específico
  const [produtoParaImagem, setProdutoParaImagem] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const produtoImageInputRef = useRef<HTMLInputElement>(null);

  // Limpar estado ao fechar
  useEffect(() => {
    if (!isOpen) {
      fecharCamera();
      setEtapa('selecao');
      setImagemCapturada(null);
      setProgressoOCR(0);
      setProdutosExtraidos([]);
      setProdutosSelecionados(new Set());
      setIsProcessing(false);
      setCameraError(null);
      setProdutoParaImagem(null);
    }
  }, [isOpen]);

  // Detectar se é dispositivo móvel
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Iniciar câmera
  const iniciarCamera = async (paraImagemProduto: boolean = false) => {
    setCameraError(null);
    
    if (paraImagemProduto) {
      setEtapa('capturandoImagem');
    } else {
      setEtapa('camera');
    }
    
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setCameraError('Não foi possível acessar a câmera. Verifique as permissões.');
      if (paraImagemProduto) {
        setEtapa('revisao');
        setProdutoParaImagem(null);
      } else {
        setEtapa('selecao');
      }
    }
  };

  // Fechar câmera
  const fecharCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // Capturar foto da câmera
  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setImagemCapturada(imageData);
      fecharCamera();
      processarImagem(imageData);
    }
  };

  // Processar arquivo de upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setImagemCapturada(imageData);
      processarImagem(imageData);
    };
    reader.readAsDataURL(file);
    
    // Limpar input
    event.target.value = '';
  };

  // Capturar foto para imagem de produto
  const capturarFotoProduto = () => {
    if (!videoRef.current || !canvasRef.current || produtoParaImagem === null) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      
      // Salvar imagem no produto
      const novosProdutos = [...produtosExtraidos];
      novosProdutos[produtoParaImagem] = {
        ...novosProdutos[produtoParaImagem],
        imagemUrl: imageData,
      };
      setProdutosExtraidos(novosProdutos);
      
      fecharCamera();
      setEtapa('revisao');
      setProdutoParaImagem(null);
      toast.success('Imagem capturada!');
    }
  };

  // Processar arquivo de upload para imagem de produto
  const handleProdutoImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || produtoParaImagem === null) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      
      // Salvar imagem no produto
      const novosProdutos = [...produtosExtraidos];
      novosProdutos[produtoParaImagem] = {
        ...novosProdutos[produtoParaImagem],
        imagemUrl: imageData,
      };
      setProdutosExtraidos(novosProdutos);
      setProdutoParaImagem(null);
      toast.success('Imagem adicionada!');
    };
    reader.readAsDataURL(file);
    
    // Limpar input
    event.target.value = '';
  };

  // Abrir seletor de imagem para produto
  const abrirSeletorImagemProduto = (index: number) => {
    setProdutoParaImagem(index);
    produtoImageInputRef.current?.click();
  };

  // Abrir câmera para foto do produto
  const abrirCameraParaProduto = (index: number) => {
    setProdutoParaImagem(index);
    iniciarCamera(true);
  };

  // Remover imagem do produto
  const removerImagemProduto = (index: number) => {
    const novosProdutos = [...produtosExtraidos];
    novosProdutos[index] = {
      ...novosProdutos[index],
      imagemUrl: undefined,
    };
    setProdutosExtraidos(novosProdutos);
  };

  // Pré-processar imagem para melhorar OCR
  const preprocessarImagem = async (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageData);
          return;
        }

        // Aumentar resolução para melhor OCR
        const scale = Math.max(1, 2000 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Desenhar imagem escalada
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Aplicar filtros para melhorar contraste
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;

        // Converter para escala de cinza e aumentar contraste
        for (let i = 0; i < data.length; i += 4) {
          // Média ponderada para escala de cinza
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // Aumentar contraste
          let newGray = ((gray - 128) * 1.5) + 128;
          newGray = Math.max(0, Math.min(255, newGray));
          
          // Binarização adaptativa (preto ou branco)
          const threshold = 140;
          const finalValue = newGray > threshold ? 255 : 0;
          
          data[i] = finalValue;
          data[i + 1] = finalValue;
          data[i + 2] = finalValue;
        }

        ctx.putImageData(imageDataObj, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageData;
    });
  };

  // Processar imagem com OCR
  const processarImagem = async (imageData: string) => {
    setEtapa('processando');
    setIsProcessing(true);
    setProgressoOCR(0);
    
    try {
      // Pré-processar imagem para melhorar qualidade
      setProgressoOCR(5);
      const imagemProcessada = await preprocessarImagem(imageData);
      setProgressoOCR(10);
      
      const TesseractModule = await import('tesseract.js');
      const result = await TesseractModule.default.recognize(imagemProcessada, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgressoOCR(10 + Math.round(m.progress * 85));
          }
        },
      });
      
      const textoExtraido = result.data.text;
      console.log('Texto OCR extraído:', textoExtraido);
      
      // Extrair produtos do texto
      const produtos = extrairProdutosDeTexto(textoExtraido);
      
      if (produtos.length === 0) {
        toast.warning('Nenhum produto identificado. Tente uma imagem mais clara ou com texto legível.');
        setEtapa('selecao');
        setImagemCapturada(null);
      } else {
        // Converter para ProdutoComImagem
        const produtosComImagem: ProdutoComImagem[] = produtos.map(p => ({
          ...p,
          imagemUrl: undefined,
        }));
        setProdutosExtraidos(produtosComImagem);
        // Selecionar todos por padrão
        setProdutosSelecionados(new Set(produtos.map((_, i) => i)));
        setEtapa('revisao');
        toast.success(`${produtos.length} produto(s) identificado(s)! Adicione as fotos.`);
      }
    } catch (err) {
      console.error('Erro no OCR:', err);
      toast.error('Erro ao processar imagem. Tente novamente.');
      setEtapa('selecao');
      setImagemCapturada(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle seleção de produto
  const toggleProduto = (index: number) => {
    const novaSelecao = new Set(produtosSelecionados);
    if (novaSelecao.has(index)) {
      novaSelecao.delete(index);
    } else {
      novaSelecao.add(index);
    }
    setProdutosSelecionados(novaSelecao);
  };

  // Editar produto
  const editarProduto = (index: number, campo: keyof ProdutoComImagem, valor: string | number) => {
    const novosProdutos = [...produtosExtraidos];
    novosProdutos[index] = {
      ...novosProdutos[index],
      [campo]: valor,
    };
    setProdutosExtraidos(novosProdutos);
  };

  // Remover produto
  const removerProduto = (index: number) => {
    setProdutosExtraidos(prev => prev.filter((_, i) => i !== index));
    setProdutosSelecionados(prev => {
      const novaSelecao = new Set(prev);
      novaSelecao.delete(index);
      // Reindexar seleções maiores
      const ajustado = new Set<number>();
      novaSelecao.forEach(i => {
        if (i < index) ajustado.add(i);
        else if (i > index) ajustado.add(i - 1);
      });
      return ajustado;
    });
  };

  // Confirmar importação
  const confirmarImportacao = () => {
    const produtosSelecionadosArray = produtosExtraidos
      .filter((_, i) => produtosSelecionados.has(i))
      .map(p => ({
        nome: p.nome,
        descricao: p.descricao,
        preco: p.preco,
        imagemUrl: p.imagemUrl,
      }));
    
    if (produtosSelecionadosArray.length === 0) {
      toast.error('Selecione pelo menos um produto');
      return;
    }
    
    onImportProducts(produtosSelecionadosArray);
    onClose();
  };

  // Reiniciar processo
  const reiniciar = () => {
    fecharCamera();
    setEtapa('selecao');
    setImagemCapturada(null);
    setProdutosExtraidos([]);
    setProdutosSelecionados(new Set());
    setProgressoOCR(0);
    setProdutoParaImagem(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Escanear Cardápio
          </DialogTitle>
          <DialogDescription>
            {etapa === 'selecao' && 'Fotografe ou envie uma imagem do cardápio em papel para cadastrar produtos automaticamente'}
            {etapa === 'camera' && 'Posicione a câmera sobre o cardápio'}
            {etapa === 'capturandoImagem' && 'Tire uma foto do produto'}
            {etapa === 'processando' && 'Processando imagem...'}
            {etapa === 'revisao' && 'Revise os produtos e adicione as fotos'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Etapa: Seleção de método */}
          {etapa === 'selecao' && (
            <div className="py-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Botão Câmera */}
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => iniciarCamera(false)}
                >
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">Usar Câmera</h3>
                    <p className="text-sm text-muted-foreground">
                      {isMobile ? 'Tire uma foto do cardápio' : 'Capture com a webcam'}
                    </p>
                  </CardContent>
                </Card>

                {/* Botão Upload */}
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-accent" />
                    </div>
                    <h3 className="font-semibold mb-1">Enviar Imagem</h3>
                    <p className="text-sm text-muted-foreground">
                      Selecione uma foto da galeria
                    </p>
                  </CardContent>
                </Card>
              </div>

              {cameraError && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{cameraError}</span>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Dicas para melhor resultado
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use boa iluminação e evite sombras</li>
                  <li>• Mantenha a câmera estável e paralela ao cardápio</li>
                  <li>• Certifique-se que o texto está nítido e legível</li>
                  <li>• Preços devem estar no formato "R$ XX,XX" ou "XX,XX"</li>
                </ul>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* Etapa: Câmera */}
          {etapa === 'camera' && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover rounded-lg bg-black"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Guia visual */}
              <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-white/90"
                  onClick={() => {
                    fecharCamera();
                    setEtapa('selecao');
                  }}
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </Button>
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                  onClick={capturarFoto}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capturar
                </Button>
              </div>
            </div>
          )}

          {/* Etapa: Câmera para imagem de produto */}
          {etapa === 'capturandoImagem' && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-square sm:aspect-[4/3] object-cover rounded-lg bg-black"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Título do produto */}
              <div className="absolute top-4 left-4 right-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 text-center">
                <p className="text-sm font-medium">
                  Fotografando: {produtoParaImagem !== null && produtosExtraidos[produtoParaImagem]?.nome}
                </p>
              </div>
              
              {/* Guia quadrado para foto do produto */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-primary rounded-xl" />
              </div>
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-white/90"
                  onClick={() => {
                    fecharCamera();
                    setEtapa('revisao');
                    setProdutoParaImagem(null);
                  }}
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </Button>
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                  onClick={capturarFotoProduto}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capturar Foto
                </Button>
              </div>
            </div>
          )}

          {/* Etapa: Processando */}
          {etapa === 'processando' && (
            <div className="py-12 space-y-6">
              {imagemCapturada && (
                <div className="relative mx-auto max-w-sm">
                  <img 
                    src={imagemCapturada} 
                    alt="Cardápio capturado" 
                    className="w-full rounded-lg opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-background/80 backdrop-blur-sm rounded-xl p-6 text-center">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-primary" />
                      <p className="font-medium">Analisando cardápio...</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Identificando produtos e preços
                      </p>
                      <Progress value={progressoOCR} className="w-48" />
                      <p className="text-xs text-muted-foreground mt-1">{progressoOCR}%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etapa: Revisão */}
          {etapa === 'revisao' && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {produtosExtraidos.map((produto, index) => (
                  <Card 
                    key={index}
                    className={`transition-all ${
                      produtosSelecionados.has(index) 
                        ? 'border-primary bg-primary/5' 
                        : 'opacity-60'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={produtosSelecionados.has(index)}
                          onCheckedChange={() => toggleProduto(index)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 space-y-3">
                          {/* Header com confiança e delete */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              produto.confianca >= 80 
                                ? 'bg-green-100 text-green-700' 
                                : produto.confianca >= 60 
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}>
                              {produto.confianca}% confiança
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removerProduto(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {/* Imagem do produto */}
                          <div className="flex items-center gap-3">
                            <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {produto.imagemUrl ? (
                                <>
                                  <img 
                                    src={produto.imagemUrl} 
                                    alt={produto.nome}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removerImagemProduto(index)}
                                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-1"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => abrirCameraParaProduto(index)}
                                className="text-xs h-8"
                              >
                                <Camera className="w-3 h-3 mr-1" />
                                Tirar Foto
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirSeletorImagemProduto(index)}
                                className="text-xs h-8"
                              >
                                <Upload className="w-3 h-3 mr-1" />
                                Galeria
                              </Button>
                            </div>
                          </div>
                          
                          {/* Campos editáveis */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Nome *</Label>
                              <Input
                                value={produto.nome}
                                onChange={(e) => editarProduto(index, 'nome', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Preço (R$) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={produto.preco}
                                onChange={(e) => editarProduto(index, 'preco', parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Descrição (opcional)</Label>
                            <Textarea
                              value={produto.descricao}
                              onChange={(e) => editarProduto(index, 'descricao', e.target.value)}
                              rows={2}
                              className="resize-none"
                              placeholder="Ingredientes, detalhes..."
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input oculto para upload de imagem de produto */}
        <input
          ref={produtoImageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handleProdutoImageUpload}
        />

        {/* Footer com ações */}
        {etapa === 'revisao' && (
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
              <Check className="w-4 h-4" />
              {produtosSelecionados.size} de {produtosExtraidos.length} selecionado(s)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reiniciar}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Nova Foto
              </Button>
              <Button 
                onClick={confirmarImportacao}
                disabled={produtosSelecionados.size === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                Importar {produtosSelecionados.size > 0 && `(${produtosSelecionados.size})`}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
