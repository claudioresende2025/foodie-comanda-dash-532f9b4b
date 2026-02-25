import { useState } from "react";
import { ShoppingBag, Plus, Check, ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ===============================================
// ESTRUTURA DE DADOS - CARDÁPIO DIGITAL DEMO
// ===============================================

interface MenuItem {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem: string;
  categoria: string;
}

interface Categoria {
  id: string;
  nome: string;
  icone: string;
}

const categorias: Categoria[] = [
  { id: "entradas", nome: "Entradas", icone: "🥟" },
  { id: "pizzas", nome: "Pizzas", icone: "🍕" },
  { id: "principais", nome: "Pratos Principais", icone: "🍽️" },
  { id: "bebidas", nome: "Bebidas", icone: "🥤" },
  { id: "sobremesas", nome: "Sobremesas", icone: "🍰" },
];

const menuItems: MenuItem[] = [
  // ENTRADAS
  {
    id: "ent-1",
    nome: "Batata Frita Rústica",
    descricao: "Batatas cortadas em gomos, fritas até ficarem crocantes, temperadas com ervas finas e sal marinho.",
    preco: 28.90,
    imagem: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop",
    categoria: "entradas",
  },
  {
    id: "ent-2",
    nome: "Batata com Bacon e Cheddar",
    descricao: "Porção generosa de batatas fritas cobertas com bacon crocante e molho cheddar cremoso.",
    preco: 38.90,
    imagem: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&h=300&fit=crop",
    categoria: "entradas",
  },
  {
    id: "ent-3",
    nome: "Mix de Mini Coxinhas",
    descricao: "12 mini coxinhas sortidas: frango, carne seca e queijo. Acompanha molho especial.",
    preco: 42.90,
    imagem: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
    categoria: "entradas",
  },

  // PIZZAS
  {
    id: "piz-1",
    nome: "Calabresa Especial",
    descricao: "Molho de tomate artesanal, mussarela, calabresa fatiada, cebola roxa e orégano fresco.",
    preco: 59.90,
    imagem: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    categoria: "pizzas",
  },
  {
    id: "piz-2",
    nome: "Margherita com Manjericão Fresco",
    descricao: "Molho de tomate italiano, mussarela de búfala, tomate cereja e manjericão fresco.",
    preco: 54.90,
    imagem: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    categoria: "pizzas",
  },
  {
    id: "piz-3",
    nome: "Quatro Queijos Premium",
    descricao: "Mussarela, gorgonzola, provolone e parmesão, finalizados com mel trufado.",
    preco: 69.90,
    imagem: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop",
    categoria: "pizzas",
  },

  // PRATOS PRINCIPAIS
  {
    id: "pri-1",
    nome: "Filé Mignon ao Molho Madeira",
    descricao: "Medalhão de filé mignon grelhado ao ponto, molho madeira com cogumelos. Acompanha arroz e batatas.",
    preco: 89.90,
    imagem: "https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=300&fit=crop",
    categoria: "principais",
  },
  {
    id: "pri-2",
    nome: "Salmão Grelhado com Risoto",
    descricao: "Filé de salmão grelhado na manteiga de ervas, servido com risoto de limão siciliano.",
    preco: 98.90,
    imagem: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop",
    categoria: "principais",
  },
  {
    id: "pri-3",
    nome: "Picanha na Chapa",
    descricao: "300g de picanha na chapa com alho dourado. Acompanha arroz, feijão tropeiro e vinagrete.",
    preco: 79.90,
    imagem: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=400&h=300&fit=crop",
    categoria: "principais",
  },

  // BEBIDAS
  {
    id: "beb-1",
    nome: "Sucos Naturais",
    descricao: "Suco natural de laranja ou limão (500ml). Feito na hora com frutas selecionadas.",
    preco: 14.90,
    imagem: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop",
    categoria: "bebidas",
  },
  {
    id: "beb-2",
    nome: "Refrigerantes Lata",
    descricao: "Coca-Cola, Guaraná Antarctica, Sprite ou Fanta (350ml).",
    preco: 8.90,
    imagem: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400&h=300&fit=crop",
    categoria: "bebidas",
  },
  {
    id: "beb-3",
    nome: "Água Mineral",
    descricao: "Água mineral sem gás ou com gás (500ml).",
    preco: 6.90,
    imagem: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop",
    categoria: "bebidas",
  },
  {
    id: "beb-4",
    nome: "Cervejas Artesanais",
    descricao: "Seleção de cervejas artesanais locais: IPA, Pilsen e Weiss (473ml).",
    preco: 22.90,
    imagem: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop",
    categoria: "bebidas",
  },

  // SOBREMESAS
  {
    id: "sob-1",
    nome: "Petit Gâteau",
    descricao: "Bolinho de chocolate com coração derretido, servido com sorvete de baunilha e calda de frutas vermelhas.",
    preco: 32.90,
    imagem: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=300&fit=crop",
    categoria: "sobremesas",
  },
  {
    id: "sob-2",
    nome: "Picolés Frutados",
    descricao: "Duo de picolés artesanais de frutas da estação. Sabores rotativos.",
    preco: 16.90,
    imagem: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop",
    categoria: "sobremesas",
  },
  {
    id: "sob-3",
    nome: "Pudim de Leite Condensado",
    descricao: "Pudim caseiro tradicional com calda de caramelo. Receita da vovó.",
    preco: 18.90,
    imagem: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&h=300&fit=crop",
    categoria: "sobremesas",
  },
];

// ===============================================
// COMPONENTE CARD DO PRODUTO
// ===============================================

interface ProductCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  isAdded: boolean;
}

const ProductCard = ({ item, onAdd, isAdded }: ProductCardProps) => {
  return (
    <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-white">
      <div className="relative overflow-hidden aspect-[4/3]">
        <img
          src={item.imagem}
          alt={item.nome}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <Badge className="absolute top-3 right-3 bg-orange-500/90 hover:bg-orange-500 text-white font-bold text-sm px-3 py-1">
          R$ {item.preco.toFixed(2).replace('.', ',')}
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-1">
          {item.nome}
        </h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[40px]">
          {item.descricao}
        </p>
        <Button
          onClick={() => onAdd(item)}
          className={cn(
            "w-full transition-all duration-300 font-semibold",
            isAdded
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-orange-500 hover:bg-orange-600 text-white"
          )}
        >
          {isAdded ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Adicionado
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar ao Carrinho
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// ===============================================
// COMPONENTE PRINCIPAL - CARDÁPIO DIGITAL
// ===============================================

const CardapioDigitalDemo = () => {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("todas");
  const [carrinho, setCarrinho] = useState<Map<string, number>>(new Map());
  const [busca, setBusca] = useState("");
  const [itensAdicionados, setItensAdicionados] = useState<Set<string>>(new Set());

  // Total de itens no carrinho
  const totalItens = Array.from(carrinho.values()).reduce((acc, qty) => acc + qty, 0);

  // Total em R$
  const totalValor = Array.from(carrinho.entries()).reduce((acc, [id, qty]) => {
    const item = menuItems.find(i => i.id === id);
    return acc + (item ? item.preco * qty : 0);
  }, 0);

  // Filtrar itens
  const itensFiltrados = menuItems.filter(item => {
    const matchCategoria = categoriaAtiva === "todas" || item.categoria === categoriaAtiva;
    const matchBusca = item.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       item.descricao.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchBusca;
  });

  // Adicionar item ao carrinho
  const handleAddItem = (item: MenuItem) => {
    setCarrinho(prev => {
      const newCart = new Map(prev);
      newCart.set(item.id, (prev.get(item.id) || 0) + 1);
      return newCart;
    });

    // Feedback visual temporário
    setItensAdicionados(prev => new Set(prev).add(item.id));
    setTimeout(() => {
      setItensAdicionados(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }, 1500);

    // Toast de feedback
    toast.success(
      <div className="flex items-center gap-3">
        <img 
          src={item.imagem} 
          alt={item.nome} 
          className="w-12 h-12 rounded-lg object-cover"
        />
        <div>
          <p className="font-semibold">{item.nome}</p>
          <p className="text-sm text-gray-500">Adicionado ao carrinho</p>
        </div>
      </div>,
      {
        duration: 2500,
        position: "top-center",
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo / Voltar */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-xl text-gray-800">Cardápio Digital</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Teste de Experiência do Usuário</p>
              </div>
            </div>

            {/* Busca (desktop) */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
                />
              </div>
            </div>

            {/* Carrinho */}
            <Button 
              variant="outline" 
              className="relative flex items-center gap-2 border-orange-200 hover:bg-orange-50"
            >
              <ShoppingBag className="w-5 h-5 text-orange-500" />
              <span className="hidden sm:inline text-gray-700">
                R$ {totalValor.toFixed(2).replace('.', ',')}
              </span>
              {totalItens > 0 && (
                <Badge 
                  className="absolute -top-2 -right-2 bg-orange-500 hover:bg-orange-500 text-white w-6 h-6 flex items-center justify-center p-0 text-xs font-bold animate-bounce"
                >
                  {totalItens > 99 ? "99+" : totalItens}
                </Badge>
              )}
            </Button>
          </div>

          {/* Busca (mobile) */}
          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar no cardápio..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO POR CATEGORIAS */}
        <div className="border-t bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
              <Button
                variant={categoriaAtiva === "todas" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoriaAtiva("todas")}
                className={cn(
                  "shrink-0 rounded-full transition-all",
                  categoriaAtiva === "todas"
                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                    : "bg-white hover:bg-orange-50 border-gray-200"
                )}
              >
                🍴 Todos
              </Button>
              {categorias.map((cat) => (
                <Button
                  key={cat.id}
                  variant={categoriaAtiva === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full transition-all",
                    categoriaAtiva === cat.id
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                      : "bg-white hover:bg-orange-50 border-gray-200"
                  )}
                >
                  {cat.icone} {cat.nome}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Título da categoria */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {categoriaAtiva === "todas" 
              ? "Cardápio Completo" 
              : categorias.find(c => c.id === categoriaAtiva)?.nome || ""}
          </h2>
          <p className="text-gray-500 mt-1">
            {itensFiltrados.length} {itensFiltrados.length === 1 ? "item disponível" : "itens disponíveis"}
          </p>
        </div>

        {/* Grid de Produtos */}
        {itensFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {itensFiltrados.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onAdd={handleAddItem}
                isAdded={itensAdicionados.has(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Nenhum item encontrado
            </h3>
            <p className="text-gray-400 max-w-md">
              Não encontramos itens com "{busca}" nesta categoria. Tente buscar por outro termo ou categoria.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setBusca("");
                setCategoriaAtiva("todas");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </main>

      {/* FOOTER FIXO COM RESUMO DO CARRINHO (mobile) */}
      {totalItens > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg md:hidden z-40">
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-6 rounded-xl shadow-lg">
            <ShoppingBag className="w-5 h-5 mr-2" />
            Ver Carrinho ({totalItens} {totalItens === 1 ? "item" : "itens"}) • R$ {totalValor.toFixed(2).replace('.', ',')}
          </Button>
        </div>
      )}

      {/* Espaçamento extra no mobile quando carrinho visível */}
      {totalItens > 0 && <div className="h-24 md:hidden" />}
    </div>
  );
};

export default CardapioDigitalDemo;
