import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, CreditCard, QrCode, Star, Ticket, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PixQRCode } from "@/components/pix/PixQRCode";
import { maskPhone, maskCEP, fetchAddressByCEP, isValidCEP } from "@/utils/masks";
import { RestaurantHeader } from "@/components/delivery/RestaurantHeader";
import { ProductCard } from "@/components/delivery/ProductCard";
import { CartButton } from "@/components/delivery/CartButton";
import { BottomNavigation } from "@/components/delivery/BottomNavigation";
import { useCart } from "@/hooks/useCart";

export default function DeliveryRestaurant() {
  const { empresaId } = useParams();
  const navigate = useNavigate();

  const [empresa, setEmpresa] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingCEP, setIsFetchingCEP] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [valorPix, setValorPix] = useState(0);
  const [pedidoId, setPedidoId] = useState<string | null>(null);

  // Estados para endereços salvos
  const [enderecosSalvos, setEnderecosSalvos] = useState<any[]>([]);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<string>("");
  const [marcarComoPadrao, setMarcarComoPadrao] = useState(false);
  const [usandoEnderecoSalvo, setUsandoEnderecoSalvo] = useState(false);

  // Estados para cupom e fidelidade
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<any>(null);
  const [aplicandoCupom, setAplicandoCupom] = useState(false);
  const [fidelidadeData, setFidelidadeData] = useState<any>(null);
  const [usarPontosFidelidade, setUsarPontosFidelidade] = useState(false);
  const [pontosAUtilizar, setPontosAUtilizar] = useState(0);

  const [metodoPagamento, setMetodoPagamento] = useState("pix");
  const [notasGerais, setNotasGerais] = useState("");
  const [marcaCartao, setMarcaCartao] = useState("");
  const [endereco, setEndereco] = useState({
    nome_cliente: "",
    telefone: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "SP",
    cep: "",
    referencia: "",
  });

  const { cart, addToCart, removeFromCart, clearCart, getQuantity, subtotal, total, itemCount } = useCart(
    config?.taxa_entrega || 0,
  );

  // Calcular valor do desconto de pontos de fidelidade
  const descontoPontos = usarPontosFidelidade && fidelidadeData
    ? (pontosAUtilizar * (fidelidadeData.reais_por_ponto || 0.01))
    : 0;

  // Calcular desconto do cupom
  const descontoCupom = cupomAplicado
    ? cupomAplicado.tipo === "percentual"
      ? (subtotal * cupomAplicado.valor) / 100
      : cupomAplicado.valor
    : 0;

  // Total de descontos
  const desconto = descontoCupom + descontoPontos;
  const totalComDesconto = Math.max(0, total - desconto);

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user || null);

    // Buscar endereços salvos
    if (session?.user) {
      const { data: enderecos } = await supabase
        .from("enderecos_cliente")
        .select("*")
        .eq("user_id", session.user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (enderecos && enderecos.length > 0) {
        setEnderecosSalvos(enderecos);
        
        // Se tem endereço padrão, usar ele
        const enderecoPadrao = enderecos.find(e => e.is_default);
        if (enderecoPadrao) {
          setEnderecoSelecionadoId(enderecoPadrao.id);
          carregarEndereco(enderecoPadrao);
        }
      }

      // Buscar fidelidade
      if (empresaId) {
        // Buscar pontos do usuário
        const { data: fidelidade } = await supabase
          .from("fidelidade_pontos")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (fidelidade) {
          // Buscar configuração de fidelidade da empresa
          const { data: config } = await supabase
            .from("fidelidade_config")
            .select("*")
            .eq("empresa_id", empresaId)
            .eq("ativo", true)
            .maybeSingle();
          
          if (config) {
            setFidelidadeData({
              id: fidelidade.id,
              pontos_atuais: fidelidade.pontos || 0,
              pontos_necessarios: config.pontos_necessarios || 100,
              valor_recompensa: config.valor_recompensa || 15,
              percentual: ((fidelidade.pontos || 0) / (config.pontos_necessarios || 100)) * 100,
              reais_por_ponto: config.pontos_por_real || 0.01,
            });
          }
        }
      }
    }
  }, [empresaId]);

  const carregarEndereco = (end: any) => {
    setEndereco({
      nome_cliente: end.nome_cliente,
      telefone: maskPhone(end.telefone),
      rua: end.rua,
      numero: end.numero,
      complemento: end.complemento || "",
      bairro: end.bairro,
      cidade: end.cidade,
      estado: end.estado,
      cep: maskCEP(end.cep),
      referencia: end.referencia || "",
    });
    setUsandoEnderecoSalvo(true);
  };

  const handleEnderecoSelecionado = (enderecoId: string) => {
    setEnderecoSelecionadoId(enderecoId);
    const endSelecionado = enderecosSalvos.find(e => e.id === enderecoId);
    if (endSelecionado) {
      carregarEndereco(endSelecionado);
    } else {
      // "Novo endereço" selecionado
      setEndereco({
        nome_cliente: "",
        telefone: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "SP",
        cep: "",
        referencia: "",
      });
      setUsandoEnderecoSalvo(false);
    }
  };

  const aplicarCupom = async () => {
    if (!cupomCodigo.trim() || !empresaId) return;
    
    setAplicandoCupom(true);
    try {
      const { data: cupom, error } = await supabase
        .from("cupons")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("codigo", cupomCodigo.toUpperCase())
        .eq("ativo", true)
        .maybeSingle();

      if (error || !cupom) {
        toast.error("Cupom inválido ou expirado");
        return;
      }

      // Verificar se já foi usado
      if (cupom.uso_maximo && cupom.uso_atual >= cupom.uso_maximo) {
        toast.error("Cupom esgotado");
        return;
      }

      // Verificar valor mínimo
      if (cupom.valor_minimo_pedido && subtotal < cupom.valor_minimo_pedido) {
        toast.error(`Pedido mínimo: R$ ${cupom.valor_minimo_pedido.toFixed(2)}`);
        return;
      }

      setCupomAplicado(cupom);
      toast.success(`Cupom aplicado! ${cupom.tipo === "percentual" ? `${cupom.valor}% OFF` : `R$ ${cupom.valor.toFixed(2)} OFF`}`);
    } catch (err) {
      toast.error("Erro ao aplicar cupom");
    } finally {
      setAplicandoCupom(false);
    }
  };

  const removerCupom = () => {
    setCupomAplicado(null);
    setCupomCodigo("");
    toast.info("Cupom removido");
  };

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    try {
      console.log('[DeliveryRestaurant] Fetching data for empresa:', empresaId);
      
      const { data: emp, error: empError } = await supabase.from("empresas").select("*").eq("id", empresaId).maybeSingle();
      if (empError) {
        console.error('[DeliveryRestaurant] Error fetching empresa:', empError);
      }
      console.log('[DeliveryRestaurant] Empresa:', emp);
      setEmpresa(emp);
      
      const { data: cfg, error: cfgError } = await supabase
        .from("config_delivery")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (cfgError) {
        console.error('[DeliveryRestaurant] Error fetching config:', cfgError);
      }
      console.log('[DeliveryRestaurant] Config:', cfg);
      setConfig(cfg);
      
      const { data: prods, error: prodsError } = await supabase
        .from("produtos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (prodsError) {
        console.error('[DeliveryRestaurant] Error fetching produtos:', prodsError);
      }
      console.log('[DeliveryRestaurant] Produtos:', prods?.length || 0);
      let produtosList = prods || [];

      // Buscar combos e adicionar à lista de produtos exibidos (para delivery)
      try {
        const { data: combos } = await supabase
          .from('combos')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false });

        if (combos && combos.length > 0) {
          const combosMapped = combos.map((c: any) => ({
            id: `combo:${c.id}`,
            nome: `${c.nome} (Combo)`,
            descricao: c.descricao || null,
            preco: c.preco_combo || 0,
            imagem_url: c.imagem_url || null,
            is_combo: true,
            combo_id: c.id,
          }));

          produtosList = [...produtosList, ...combosMapped];
        }
      } catch (err) {
        console.warn('[DeliveryRestaurant] Falha ao carregar combos', err);
      }

      setProdutos(produtosList);
    } catch (err) {
      console.error('[DeliveryRestaurant] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchData();
    checkAuth();
  }, [fetchData, checkAuth]);

  const handleCEPChange = async (value: string) => {
    const maskedCEP = maskCEP(value);
    setEndereco((prev) => ({ ...prev, cep: maskedCEP }));
    if (isValidCEP(maskedCEP)) {
      setIsFetchingCEP(true);
      const addressData = await fetchAddressByCEP(maskedCEP);
      setIsFetchingCEP(false);
      if (addressData) {
        setEndereco((prev) => ({
          ...prev,
          rua: addressData.rua || prev.rua,
          bairro: addressData.bairro || prev.bairro,
          cidade: addressData.cidade || prev.cidade,
          estado: addressData.estado || prev.estado,
        }));
      }
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Faça login para continuar");
      navigate("/delivery/auth", { state: { from: `/delivery/${empresaId}` } });
      return;
    }

    if (!endereco.nome_cliente || !endereco.telefone || !endereco.cep || !endereco.numero || !endereco.rua) {
      return toast.error("Preencha todos os campos obrigatórios.");
    }

    setIsProcessing(true);
    try {
      let enderecoId = enderecoSelecionadoId;

      // Se não está usando endereço salvo ou quer marcar como padrão, criar/atualizar
      if (!usandoEnderecoSalvo || marcarComoPadrao) {
        const { data: addr, error: addrErr } = await supabase
          .from("enderecos_cliente")
          .insert({
            nome_cliente: endereco.nome_cliente,
            telefone: endereco.telefone.replace(/\D/g, ""),
            rua: endereco.rua,
            numero: endereco.numero,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            cep: endereco.cep.replace(/\D/g, ""),
            estado: endereco.estado,
            complemento: endereco.complemento || null,
            referencia: endereco.referencia || null,
            user_id: user.id,
            is_default: marcarComoPadrao,
          })
          .select()
          .single();

        if (addrErr) throw new Error("Falha ao salvar endereço no banco.");
        enderecoId = addr.id;

        // Se marcou como padrão, desmarcar outros
        if (marcarComoPadrao) {
          await supabase
            .from("enderecos_cliente")
            .update({ is_default: false })
            .eq("user_id", user.id)
            .neq("id", addr.id);
        }
      }

      // Preparar dados do pedido (SEM criar no banco ainda)
      const orderData = {
        empresaId: empresaId,
        empresaNome: empresa?.nome_fantasia || 'Restaurante',
        enderecoId: enderecoId,
        userId: user.id,
        subtotal: subtotal,
        taxaEntrega: config?.taxa_entrega || 0,
        desconto: desconto || 0,
        descontoPontos: descontoPontos || 0,
        descontoCupom: descontoCupom || 0,
        pontosUtilizados: usarPontosFidelidade ? pontosAUtilizar : 0,
        total: totalComDesconto,
        cupomId: cupomAplicado?.id || null,
        notas: notasGerais || null,
        items: cart.map((item) => ({
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco,
          subtotal: item.produto.preco * item.quantidade,
        })),
      };

      if (metodoPagamento === "pix") {
        // Para PIX, criar pedido direto (não precisa esperar confirmação)
        const { data: ped, error: pedErr } = await supabase
          .from("pedidos_delivery")
          .insert({
            empresa_id: empresaId,
            endereco_id: enderecoId,
            status: "pendente",
            subtotal: subtotal,
            taxa_entrega: config?.taxa_entrega || 0,
            desconto: desconto || null,
            total: totalComDesconto,
            forma_pagamento: "pix",
            cupom_id: cupomAplicado?.id || null,
            // Anexa marca do cartão de fidelidade nas notas para não depender de alteração do schema
            notas: `${notasGerais || ''}${marcaCartao ? `\nMarca cartão fidelidade: ${marcaCartao}` : ''}` || null,
            user_id: user.id,
          })
          .select()
          .single();

        if (pedErr) throw new Error("Erro ao criar pedido.");

        await supabase.from("itens_delivery").insert(
          cart.map((item) => ({
            pedido_delivery_id: ped.id,
            produto_id: item.produto.id,
            nome_produto: item.produto.nome,
            quantidade: item.quantidade,
            preco_unitario: item.produto.preco,
            subtotal: item.produto.preco * item.quantidade,
          })),
        );

        // Registrar uso do cupom
        if (cupomAplicado) {
          await supabase.from("cupons_uso").insert({
            cupom_id: cupomAplicado.id,
            user_id: user.id,
            pedido_delivery_id: ped.id,
            valor_desconto: descontoCupom,
          });
        }

        // Processar resgate de pontos de fidelidade
        if (usarPontosFidelidade && pontosAUtilizar > 0 && fidelidadeData?.id) {
          // Debitar pontos do saldo
          const { error: pontoErr } = await supabase
            .from("fidelidade_pontos")
            .update({
              saldo_pontos: fidelidadeData.pontos_atuais - pontosAUtilizar,
              updated_at: new Date().toISOString(),
            })
            .eq("id", fidelidadeData.id);

          if (pontoErr) {
            console.error("Erro ao debitar pontos:", pontoErr);
          }

          // Registrar transação de resgate
          await supabase.from("fidelidade_transacoes").insert({
            fidelidade_id: fidelidadeData.id,
            pontos: -pontosAUtilizar,
            descricao: "Resgate em pedido",
            pedido_delivery_id: ped.id,
          });
        }

        setPedidoId(ped.id);
        setValorPix(totalComDesconto);
        setShowPixModal(true);
        setIsCheckoutOpen(false);
        clearCart();
      } else {
        // Para cartão: enviar dados para criar checkout do Stripe
        // O pedido só será criado APÓS o pagamento ser confirmado
        console.log('[DeliveryRestaurant] Criando checkout session com orderData:', orderData);
        
        const { data, error: sErr } = await supabase.functions.invoke("create-delivery-checkout", {
          body: {
            orderData: orderData,
            total: totalComDesconto,
          },
        });

        if (sErr) {
          console.error('[DeliveryRestaurant] Erro ao criar checkout:', sErr);
          
          // Mensagens de erro mais específicas
          let errorMessage = "Erro ao processar pagamento com cartão.";
          
          if (sErr.message?.includes("STRIPE_SECRET_KEY")) {
            errorMessage = "Sistema de pagamento não configurado. Entre em contato com o restaurante.";
          } else if (sErr.message?.includes("valor")) {
            errorMessage = "Erro na validação do valor. Tente atualizar a página.";
          } else if (sErr.message) {
            errorMessage = sErr.message;
          }
          
          throw new Error(errorMessage);
        }

        if (!data?.url) {
          console.error('[DeliveryRestaurant] URL do checkout não retornada:', data);
          throw new Error("Não foi possível gerar o link de pagamento. Tente novamente.");
        }

        console.log('[DeliveryRestaurant] Checkout session criado, redirecionando para:', data.url);
        
        // Limpar carrinho antes de redirecionar
        clearCart();
        
        // Redirecionar para o Stripe Checkout
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Erro no Checkout:", err);
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground mt-3">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      <RestaurantHeader empresa={empresa} config={config} onBack={() => navigate(-1)} />

      <main className="p-4 space-y-3 max-w-2xl mx-auto">
        {produtos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum produto disponível</p>
          </div>
        ) : (
          produtos.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              quantity={getQuantity(p.id)}
              onAdd={() => {
                addToCart(p);
                toast.success("Adicionado!");
              }}
              onRemove={() => removeFromCart(p.id)}
            />
          ))
        )}
      </main>

      <CartButton itemCount={itemCount} total={total} onClick={() => setIsCheckoutOpen(true)} />

      <BottomNavigation />

      <Sheet open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <SheetContent side="bottom" className="h-[92vh] rounded-t-[2rem] p-0 overflow-hidden flex flex-col">
          <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-1" />
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="text-xl font-bold">Finalizar Pedido</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 pb-20">
              {/* Cartão Fidelidade */}
              {fidelidadeData && fidelidadeData.pontos_atuais > 0 && (
                <div className="bg-gradient-to-r from-purple-500 to-purple-700 text-white p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">Programa de Fidelidade</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{fidelidadeData.pontos_atuais} / {fidelidadeData.pontos_necessarios} pontos</span>
                    <span className="font-semibold">{fidelidadeData.percentual.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-purple-300 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(fidelidadeData.percentual, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs opacity-90">
                    Faltam {Math.max(0, fidelidadeData.pontos_necessarios - fidelidadeData.pontos_atuais)} pontos para ganhar R$ {fidelidadeData.valor_recompensa.toFixed(2)} 🎁
                  </p>
                </div>
              )}

              {/* Resgatar Pontos de Fidelidade */}
              {fidelidadeData && fidelidadeData.pontos_atuais > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-primary flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    Usar Pontos de Fidelidade
                  </Label>
                  <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="usar-pontos"
                          checked={usarPontosFidelidade}
                          onCheckedChange={(checked) => {
                            setUsarPontosFidelidade(checked as boolean);
                            if (!checked) {
                              setPontosAUtilizar(0);
                            } else {
                              // Calcular máximo de pontos que podem ser usados
                              // Total com cupom mas sem pontos ainda
                              const totalSemPontos = total - descontoCupom;
                              const maxPontosParaPedido = Math.floor(totalSemPontos / (fidelidadeData.reais_por_ponto || 0.01));
                              const maxPontos = Math.min(fidelidadeData.pontos_atuais, maxPontosParaPedido);
                              setPontosAUtilizar(maxPontos);
                            }
                          }}
                        />
                        <div>
                          <label htmlFor="usar-pontos" className="text-sm font-medium cursor-pointer">
                            Resgatar pontos neste pedido
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Você tem {fidelidadeData.pontos_atuais} pontos disponíveis
                          </p>
                        </div>
                      </div>
                    </div>
                    {usarPontosFidelidade && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Pontos a utilizar:</span>
                          <span className="font-semibold">{pontosAUtilizar} pontos</span>
                        </div>
                        <Input
                          type="range"
                          min="0"
                          max={Math.min(
                            fidelidadeData.pontos_atuais,
                            Math.floor((total - descontoCupom) / (fidelidadeData.reais_por_ponto || 0.01))
                          )}
                          value={pontosAUtilizar}
                          onChange={(e) => setPontosAUtilizar(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="bg-white p-2 rounded-lg border">
                          <p className="text-xs text-muted-foreground">Desconto:</p>
                          <p className="font-bold text-purple-600">
                            -R$ {(pontosAUtilizar * (fidelidadeData.reais_por_ponto || 0.01)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cupom de Desconto */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-primary flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Cupom de Desconto
                </Label>
                {!cupomAplicado ? (
                  <div className="flex gap-2">
                    <Input
                      value={cupomCodigo}
                      onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
                      placeholder="Digite o código"
                      className="h-12 rounded-xl uppercase"
                    />
                    <Button
                      onClick={aplicarCupom}
                      disabled={aplicandoCupom || !cupomCodigo.trim()}
                      className="h-12 px-6 rounded-xl"
                    >
                      {aplicandoCupom ? <Loader2 className="animate-spin" /> : "Aplicar"}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-green-50 border-2 border-green-500 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">{cupomAplicado.codigo}</p>
                        <p className="text-sm text-green-700">
                          -{cupomAplicado.tipo === "percentual" ? `${cupomAplicado.valor}%` : `R$ ${cupomAplicado.valor.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removerCupom}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-base text-primary">Seus Dados</h3>
                <div className="space-y-2">
                  <Label className="text-sm">Nome Completo *</Label>
                  <Input
                    value={endereco.nome_cliente}
                    onChange={(e) => setEndereco({ ...endereco, nome_cliente: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">WhatsApp *</Label>
                  <Input
                    value={endereco.telefone}
                    onChange={(e) => setEndereco({ ...endereco, telefone: maskPhone(e.target.value) })}
                    className="h-12 rounded-xl"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Marca (cartão fidelidade) — opcional</Label>
                  <Input
                    value={marcaCartao}
                    onChange={(e) => setMarcaCartao(e.target.value)}
                    className="h-12 rounded-xl"
                    placeholder="Ex: Mastercard, Visa"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-primary flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço de Entrega
                  </h3>
                </div>

                {/* Seletor de Endereços Salvos */}
                {enderecosSalvos.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Endereços Salvos</Label>
                    <Select value={enderecoSelecionadoId} onValueChange={handleEnderecoSelecionado}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Selecione um endereço" />
                      </SelectTrigger>
                      <SelectContent>
                        {enderecosSalvos.map((end) => (
                          <SelectItem key={end.id} value={end.id}>
                            <div className="flex items-center gap-2">
                              {end.is_default && <span className="text-yellow-500">⭐</span>}
                              <span className="font-medium">{end.rua}, {end.numero}</span>
                              {end.is_default && <span className="text-xs text-muted-foreground">(Padrão)</span>}
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="novo">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">➕</span>
                            <span className="font-medium">Novo endereço</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">CEP *</Label>
                    <div className="relative">
                      <Input
                        value={endereco.cep}
                        onChange={(e) => handleCEPChange(e.target.value)}
                        maxLength={9}
                        className="h-12 rounded-xl"
                        placeholder="00000-000"
                      />
                      {isFetchingCEP && (
                        <Loader2 className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Número *</Label>
                    <Input
                      value={endereco.numero}
                      onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Rua *</Label>
                  <Input
                    value={endereco.rua}
                    onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Complemento</Label>
                  <Input
                    value={endereco.complemento}
                    onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
                    placeholder="Apto, Bloco, etc."
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Bairro</Label>
                    <Input
                      value={endereco.bairro}
                      onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Cidade</Label>
                    <Input value={endereco.cidade} disabled className="h-12 rounded-xl bg-muted" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Ponto de Referência</Label>
                  <Input
                    value={endereco.referencia}
                    onChange={(e) => setEndereco({ ...endereco, referencia: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Observações do Pedido</Label>
                  <Textarea
                    value={notasGerais}
                    onChange={(e) => setNotasGerais(e.target.value)}
                    placeholder="Ex: Retirar cebola, trocar por coca zero..."
                    className="rounded-xl resize-none"
                    rows={3}
                  />
                </div>

                {/* Marcar como endereço padrão */}
                {!usandoEnderecoSalvo && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="marcar-padrao"
                      checked={marcarComoPadrao}
                      onCheckedChange={(checked) => setMarcarComoPadrao(checked as boolean)}
                    />
                    <label
                      htmlFor="marcar-padrao"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Salvar como endereço padrão
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-base text-primary">Forma de Pagamento</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={metodoPagamento === "pix" ? "default" : "outline"}
                    className="h-16 flex-col gap-1 rounded-xl border-2"
                    onClick={() => setMetodoPagamento("pix")}
                  >
                    <QrCode className="h-5 w-5" /> PIX
                  </Button>
                  <Button
                    variant={metodoPagamento === "card" ? "default" : "outline"}
                    className="h-16 flex-col gap-1 rounded-xl border-2"
                    onClick={() => setMetodoPagamento("card")}
                  >
                    <CreditCard className="h-5 w-5" /> Cartão
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-xl border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({itemCount} itens)</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de Entrega</span>
                  <span className="text-green-600 font-medium">
                    {config?.taxa_entrega > 0 ? `R$ ${config.taxa_entrega.toFixed(2)}` : "Grátis"}
                  </span>
                </div>
                {descontoPontos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600 font-medium flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      Desconto ({pontosAUtilizar} pontos)
                    </span>
                    <span className="text-purple-600 font-bold">-R$ {descontoPontos.toFixed(2)}</span>
                  </div>
                )}
                {cupomAplicado && descontoCupom > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <Ticket className="h-4 w-4" />
                      Desconto ({cupomAplicado.codigo})
                    </span>
                    <span className="text-green-600 font-bold">-R$ {descontoCupom.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-primary">R$ {totalComDesconto.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full h-14 text-lg font-bold rounded-xl shadow-lg"
                onClick={handleCheckout}
                disabled={isProcessing || itemCount === 0}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : `Pagar R$ ${totalComDesconto.toFixed(2)}`}
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={showPixModal} onOpenChange={setShowPixModal}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <QrCode className="w-5 h-5 text-primary" />
              Pagamento PIX
            </SheetTitle>
          </SheetHeader>

          <div className="w-full max-w-md mx-auto pb-6">
            {empresa?.chave_pix ? (
              <PixQRCode
                chavePix={empresa.chave_pix}
                valor={valorPix}
                nomeRecebedor={empresa.nome_fantasia || "RESTAURANTE"}
                cidade={empresa.endereco_completo?.split(",").pop()?.trim() || "SAO PAULO"}
              />
            ) : (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6 text-center">
                <p className="text-red-700 font-semibold">⚠️ Chave PIX não configurada</p>
              </div>
            )}

            <Button
              className="w-full mt-6"
              onClick={() => {
                setShowPixModal(false);
                if (pedidoId) {
                  navigate(`/delivery/tracking/${pedidoId}`);
                } else {
                  navigate("/delivery");
                }
              }}
            >
              Acompanhar Pedido
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
