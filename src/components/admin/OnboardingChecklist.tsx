import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Circle, ChevronRight, RefreshCw, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChecklistStep {
  id: string;
  label: string;
  route: string;
  completed: boolean;
}

export default function OnboardingChecklist() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const empresaId = profile?.empresa_id;
  const [steps, setSteps] = useState<ChecklistStep[]>([
    { id: 'empresa', label: 'Cadastrar empresa', route: '/admin/empresa', completed: false },
    { id: 'categoria', label: 'Criar primeira categoria', route: '/admin/cardapio', completed: false },
    { id: 'produto', label: 'Adicionar primeiro produto', route: '/admin/cardapio', completed: false },
    { id: 'mesa', label: 'Criar primeira mesa', route: '/admin/mesas', completed: false },
    { id: 'pedido', label: 'Receber primeiro pedido', route: '/admin/pedidos', completed: false },
    { id: 'pix', label: 'Configurar chave PIX', route: '/admin/empresa', completed: false },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (empresaId) checkSteps();
  }, [empresaId]);

  const checkSteps = async () => {
    if (!empresaId) return;
    setIsLoading(true);
    try {
      const [categorias, produtos, mesas, comandas, empresa] = await Promise.all([
        supabase.from('categorias').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('mesas').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('empresas').select('chave_pix').eq('id', empresaId).single(),
      ]);

      setSteps(prev => prev.map(step => {
        switch (step.id) {
          case 'empresa': return { ...step, completed: true }; // always true if they're here
          case 'categoria': return { ...step, completed: (categorias.count || 0) > 0 };
          case 'produto': return { ...step, completed: (produtos.count || 0) > 0 };
          case 'mesa': return { ...step, completed: (mesas.count || 0) > 0 };
          case 'pedido': return { ...step, completed: (comandas.count || 0) > 0 };
          case 'pix': return { ...step, completed: !!empresa.data?.chave_pix };
          default: return step;
        }
      }));
    } catch (e) {
      console.warn('Erro ao verificar checklist:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const allDone = completedCount === steps.length;

  if (dismissed || allDone) {
    if (allDone) {
      return (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-primary/30 bg-primary/5 shadow-fcd">
              <CardContent className="pt-6 text-center">
                <PartyPopper className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">Parabéns! 🎉</h3>
                <p className="text-muted-foreground text-sm">
                  Você completou todos os passos! Seu restaurante está pronto para operar.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      );
    }
    return null;
  }

  return (
    <Card className="shadow-fcd border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🚀 Primeiros Passos</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={checkSteps} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              Fechar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
        </div>
        <div className="space-y-1">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => !step.completed && navigate(step.route)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                step.completed
                  ? 'text-muted-foreground'
                  : 'hover:bg-muted/50 cursor-pointer'
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
              )}
              <span className={`text-sm flex-1 ${step.completed ? 'line-through' : 'font-medium'}`}>
                {step.label}
              </span>
              {!step.completed && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
