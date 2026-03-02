import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, CheckCircle2 } from 'lucide-react';

export default function EmailConfirmation() {
  const [searchParams] = useSearchParams();
  
  const email = searchParams.get('email') || '';
  const type = searchParams.get('type') || 'proprietario'; // 'proprietario' ou 'cliente'
  
  const isCliente = type === 'cliente';

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isCliente 
        ? 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-500' 
        : 'bg-gradient-to-br from-secondary via-background to-fcd-orange-light'
    }`}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Ícone */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
            isCliente ? 'bg-white' : 'bg-green-100'
          }`}>
            <Mail className={`w-10 h-10 ${isCliente ? 'text-orange-500' : 'text-green-600'}`} />
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${isCliente ? 'text-white drop-shadow-lg' : 'text-foreground'}`}>
            Verifique seu e-mail
          </h1>
          <p className={isCliente ? 'text-white/80' : 'text-muted-foreground'}>
            Enviamos um link de confirmação para:
          </p>
          <p className={`font-semibold mt-2 text-lg ${isCliente ? 'text-white' : 'text-primary'}`}>
            {email}
          </p>
        </div>

        <Card className={`shadow-2xl border-0 ${isCliente ? '' : 'shadow-fcd'}`}>
          <CardHeader className="text-center pb-2">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Conta criada com sucesso!
            </CardTitle>
            <CardDescription>
              Agora confirme seu cadastro para continuar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instruções */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📧</div>
                <div>
                  <p className="font-semibold text-amber-800 mb-1">
                    Importante!
                  </p>
                  <p className="text-amber-700 text-sm">
                    Acesse seu e-mail e clique no link de confirmação que enviamos. 
                    Após confirmar, você poderá fazer login e {isCliente ? 'fazer seus pedidos' : 'configurar seu restaurante'}.
                  </p>
                </div>
              </div>
            </div>

            {/* Passos */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <p className="text-sm">Abra sua caixa de entrada</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <p className="text-sm">Procure o e-mail de "Food Comanda Pro"</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <p className="text-sm">Clique em "Fazer Login" para confirmar</p>
              </div>
            </div>

            {/* Aviso spam */}
            <p className="text-center text-muted-foreground text-sm">
              Não recebeu? Verifique sua pasta de <strong>spam</strong> ou <strong>lixo eletrônico</strong>.
            </p>

            <p className="text-xs text-center text-muted-foreground">
              Após confirmar seu e-mail, você será redirecionado para {isCliente ? 'a página de delivery' : 'fazer login'}.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
