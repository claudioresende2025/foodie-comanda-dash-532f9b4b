import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  UtensilsCrossed, ShoppingBag, Monitor, Truck, DollarSign, Megaphone,
  Clock, CheckCircle, XCircle, ArrowRight, Star, Shield, Users,
  Smartphone, BarChart3, Zap, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0, 0, 0.2, 1] as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

const problems = [
  { icon: XCircle, title: 'Controle manual e papel', desc: 'Pedidos anotados em papel, comandas perdidas e erros constantes que custam dinheiro.' },
  { icon: Clock, title: 'Demora no atendimento', desc: 'Garçom leva o pedido até a cozinha, volta, confere... enquanto o cliente espera.' },
  { icon: BarChart3, title: 'Zero visibilidade', desc: 'Não sabe quanto vendeu, qual prato mais sai, nem quanto faturou no mês.' },
  { icon: DollarSign, title: 'Perdas no caixa', desc: 'Dificuldade em fechar o caixa corretamente. Sobra ou falta sem explicação.' },
];

const solutions = [
  { icon: Smartphone, title: 'Cardápio Digital', desc: 'QR Code na mesa, cliente faz pedido direto pelo celular. Zero papel.' },
  { icon: Monitor, title: 'KDS - Tela da Cozinha', desc: 'Pedidos aparecem instantaneamente na tela da cozinha. Sem gritaria.' },
  { icon: Truck, title: 'Delivery Integrado', desc: 'Receba pedidos delivery com confirmação, rastreamento e pagamento online.' },
  { icon: DollarSign, title: 'Caixa Inteligente', desc: 'Abertura, fechamento e relatório financeiro com poucos cliques.' },
  { icon: Megaphone, title: 'Marketing & Fidelidade', desc: 'Cupons, programa de pontos e combos para aumentar seu ticket médio.' },
  { icon: BarChart3, title: 'Relatórios Completos', desc: 'Faturamento, ticket médio, itens mais vendidos — tudo em tempo real.' },
];

const testimonials = [
  { name: 'Carlos M.', restaurant: 'Cantina do Carlos', text: 'Reduzi em 40% os erros de pedido no primeiro mês. Meus garçons agradecem!', rating: 5 },
  { name: 'Ana L.', restaurant: 'Bistrô da Ana', text: 'Agora sei exatamente quanto vendo por dia. O relatório de caixa é fantástico.', rating: 5 },
  { name: 'Roberto S.', restaurant: 'Burger House', text: 'O delivery integrado triplicou meus pedidos online. Valeu cada centavo.', rating: 5 },
];

const beforeAfter = [
  { before: 'Comandas em papel que somem', after: 'Comandas digitais com histórico completo' },
  { before: 'Garçom correndo até a cozinha', after: 'Pedido aparece instantaneamente no KDS' },
  { before: 'Fechar caixa leva 1 hora', after: 'Fechamento automático em 2 minutos' },
  { before: 'Sem saber o faturamento do mês', after: 'Dashboard com métricas em tempo real' },
];

const faqs = [
  { q: 'Preciso de cartão de crédito para testar?', a: 'Não! Oferecemos 14 dias grátis sem pedir cartão. Você testa tudo antes de decidir.' },
  { q: 'Funciona em qualquer celular?', a: 'Sim! É um sistema web responsivo que funciona em qualquer dispositivo com navegador.' },
  { q: 'Preciso instalar algo?', a: 'Não. Funciona direto no navegador. Opcional: pode instalar como app (PWA) para acesso rápido.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem multa e sem burocracia. Cancele quando quiser pelo painel.' },
  { q: 'Meus dados ficam seguros?', a: 'Usamos criptografia de ponta e servidores seguros. Seus dados são só seus.' },
  { q: 'Tem suporte técnico?', a: 'Sim! Suporte via chat e email. Planos superiores têm suporte prioritário.' },
  { q: 'Quanto tempo leva para configurar?', a: 'Menos de 5 minutos. Cadastre sua empresa, crie o cardápio e está pronto.' },
  { q: 'Funciona para delivery também?', a: 'Sim! O sistema tem módulo completo de delivery com rastreamento e pagamento online.' },
];

export default function LandingRestaurantes() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">Food Comanda</h1>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/planos')}>Preços</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button size="sm" onClick={() => navigate('/auth/restaurante')}>
              Teste Grátis
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section 
        className="container mx-auto px-4 py-20 text-center"
        initial="hidden" animate="visible" variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
            <Clock className="w-3.5 h-3.5 mr-1.5" /> 14 dias grátis • Sem cartão de crédito
          </Badge>
        </motion.div>
        <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          Seu restaurante no{' '}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            piloto automático
          </span>
        </motion.h1>
        <motion.p variants={fadeUp} className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Comandas digitais, cardápio por QR Code, delivery, caixa, marketing e relatórios — tudo em uma única plataforma.
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate('/auth/restaurante')}>
            <Zap className="mr-2 w-5 h-5" /> Comece Grátis por 14 Dias
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => navigate('/planos')}>
            Ver Planos <ChevronRight className="ml-1 w-5 h-5" />
          </Button>
        </motion.div>
        <motion.p variants={fadeUp} className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Shield className="w-4 h-4" /> Sem cartão • Cancele quando quiser • Garantia de 7 dias
        </motion.p>
      </motion.section>

      {/* Problemas */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Cansado desses problemas?</h2>
            <p className="text-lg text-muted-foreground">Se você se identifica, temos a solução.</p>
          </motion.div>
          <motion.div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {problems.map((p, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="h-full border-destructive/20 bg-destructive/5">
                  <CardContent className="pt-6">
                    <p.icon className="w-10 h-10 text-destructive mb-4" />
                    <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                    <p className="text-muted-foreground text-sm">{p.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Solução / Funcionalidades */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Como resolvemos tudo isso</h2>
            <p className="text-lg text-muted-foreground">6 módulos integrados para digitalizar seu restaurante</p>
          </motion.div>
          <motion.div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {solutions.map((s, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="h-full hover:shadow-fcd transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <s.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Antes x Depois */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Antes vs. Depois</h2>
            <p className="text-lg text-muted-foreground">Veja a diferença no dia-a-dia do seu restaurante</p>
          </motion.div>
          <motion.div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {beforeAfter.map((item, i) => (
              <motion.div key={i} variants={fadeUp} className="flex items-stretch gap-3">
                <Card className="flex-1 border-destructive/20 bg-destructive/5">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                    <span className="text-sm">{item.before}</span>
                  </CardContent>
                </Card>
                <Card className="flex-1 border-primary/20 bg-primary/5">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm">{item.after}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nossos clientes dizem</h2>
          </motion.div>
          <motion.div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="h-full">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-sm mb-4 italic">"{t.text}"</p>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.restaurant}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Preços CTA */}
      <section className="bg-primary/5 py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos que cabem no seu bolso</h2>
            <p className="text-lg text-muted-foreground mb-8">A partir de R$ 149,90/mês. Teste grátis por 14 dias.</p>
            <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate('/planos')}>
              Ver Todos os Planos <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                <AccordionTrigger className="text-left font-medium">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-primary py-20 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para transformar seu restaurante?</h2>
            <p className="text-lg opacity-90 mb-8">Comece agora — sem cartão de crédito, sem compromisso.</p>
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6" onClick={() => navigate('/auth/restaurante')}>
              <Zap className="mr-2 w-5 h-5" /> Teste Grátis por 14 Dias
            </Button>
            <p className="mt-4 text-sm opacity-75 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" /> 7 dias de garantia após assinar
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-3 text-primary">Food Comanda</h3>
              <p className="text-sm text-muted-foreground">A plataforma completa para gestão de restaurantes.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => navigate('/planos')} className="hover:text-primary transition-colors">Planos e Preços</button></li>
                <li><button onClick={() => navigate('/auth/restaurante')} className="hover:text-primary transition-colors">Criar Conta</button></li>
                <li><button onClick={() => navigate('/auth')} className="hover:text-primary transition-colors">Entrar</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>suporte@foodiecomanda.com</li>
                <li>(11) 99999-9999</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Food Comanda. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
