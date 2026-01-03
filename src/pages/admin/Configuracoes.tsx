import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bell, Printer, QrCode, Palette, Shield, Download, Eye, EyeOff } from "lucide-react";
import DeliveryConfigSection from "@/components/admin/DeliveryConfigSection";
import { supabase } from "@/integrations/supabase/client";

type ConfigSettings = {
  notifyNewOrders: boolean;
  notifyReadyOrders: boolean;
  soundEnabled: boolean;
  autoPrint: boolean;
  printLogo: boolean;
  menuActive: boolean;
  clientOrdering: boolean;
  darkTheme: boolean;
  compactMenu: boolean;
};

export default function Configuracoes() {
  const [settings, setSettings] = useState<ConfigSettings>({
    notifyNewOrders: true,
    notifyReadyOrders: true,
    soundEnabled: true,
    autoPrint: false,
    printLogo: true,
    menuActive: true,
    clientOrdering: true,
    darkTheme: false,
    compactMenu: false,
  });

  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fcd-settings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  // Save settings to localStorage
  const updateSetting = (key: keyof ConfigSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem("fcd-settings", JSON.stringify(newSettings));
    toast.success("Configuração atualizada!");
  };

  const handleChangePassword = async () => {
    if (!passwords.new || !passwords.confirm) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (passwords.new.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setPasswordDialog(false);
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar senha");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleTestPrint = () => {
    const printContent = `
      ================================
            TESTE DE IMPRESSÃO
      ================================
      
      FoodComanda - Sistema de Gestão
      
      Data: ${new Date().toLocaleDateString("pt-BR")}
      Hora: ${new Date().toLocaleTimeString("pt-BR")}
      
      Este é um teste de impressão
      para verificar a configuração
      da sua impressora térmica.
      
      ================================
            TESTE CONCLUÍDO
      ================================
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <style>
              body { font-family: monospace; font-size: 12px; width: 80mm; }
              pre { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <pre>${printContent}</pre>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    toast.success("Teste de impressão enviado!");
  };

  const handleGenerateQRCodes = () => {
    toast.info("Acesse a página de Mesas para visualizar e gerar QR Codes individuais");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Personalize o sistema de acordo com suas necessidades</p>
      </div>

      <div className="grid gap-6">
        {/* Delivery - Componente autocontido */}
        <DeliveryConfigSection />

        {/* Notificações */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Notificações</CardTitle>
            </div>
            <CardDescription>Configure como você deseja receber alertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Novos pedidos</Label>
                <p className="text-sm text-muted-foreground">Receber alerta quando um novo pedido for feito</p>
              </div>
              <Switch checked={settings.notifyNewOrders} onCheckedChange={(v) => updateSetting("notifyNewOrders", v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pedidos prontos</Label>
                <p className="text-sm text-muted-foreground">Alerta quando um pedido estiver pronto para entrega</p>
              </div>
              <Switch
                checked={settings.notifyReadyOrders}
                onCheckedChange={(v) => updateSetting("notifyReadyOrders", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Som de notificação</Label>
                <p className="text-sm text-muted-foreground">Tocar som ao receber notificações</p>
              </div>
              <Switch checked={settings.soundEnabled} onCheckedChange={(v) => updateSetting("soundEnabled", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Impressão */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Impressão</CardTitle>
            </div>
            <CardDescription>Configurações de impressão de comandas e recibos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Impressão automática</Label>
                <p className="text-sm text-muted-foreground">Imprimir automaticamente novos pedidos na cozinha</p>
              </div>
              <Switch checked={settings.autoPrint} onCheckedChange={(v) => updateSetting("autoPrint", v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Imprimir logo</Label>
                <p className="text-sm text-muted-foreground">Incluir logo da empresa nos comprovantes</p>
              </div>
              <Switch checked={settings.printLogo} onCheckedChange={(v) => updateSetting("printLogo", v)} />
            </div>
            <Button variant="outline" onClick={handleTestPrint}>
              <Printer className="w-4 h-4 mr-2" />
              Testar Impressão
            </Button>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">QR Code</CardTitle>
            </div>
            <CardDescription>Configurações do menu digital via QR Code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Menu digital ativo</Label>
                <p className="text-sm text-muted-foreground">Permitir clientes acessarem o menu via QR Code</p>
              </div>
              <Switch checked={settings.menuActive} onCheckedChange={(v) => updateSetting("menuActive", v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pedido pelo cliente</Label>
                <p className="text-sm text-muted-foreground">Permitir que clientes façam pedidos diretamente</p>
              </div>
              <Switch checked={settings.clientOrdering} onCheckedChange={(v) => updateSetting("clientOrdering", v)} />
            </div>
            <Button variant="outline" onClick={handleGenerateQRCodes}>
              <Download className="w-4 h-4 mr-2" />
              Gerar QR Codes
            </Button>
          </CardContent>
        </Card>

        {/* Aparência */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Aparência</CardTitle>
            </div>
            <CardDescription>Personalize a aparência do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tema escuro</Label>
                <p className="text-sm text-muted-foreground">Usar tema escuro no painel administrativo</p>
              </div>
              <Switch
                checked={settings.darkTheme}
                onCheckedChange={(v) => {
                  updateSetting("darkTheme", v);
                  document.documentElement.classList.toggle("dark", v);
                }}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Menu compacto</Label>
                <p className="text-sm text-muted-foreground">Exibir sidebar em modo compacto</p>
              </div>
              <Switch checked={settings.compactMenu} onCheckedChange={(v) => updateSetting("compactMenu", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Segurança</CardTitle>
            </div>
            <CardDescription>Configurações de segurança da conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setPasswordDialog(true)}>
                Alterar Senha
              </Button>
              <Button variant="outline" onClick={() => toast.info("Autenticação em dois fatores em desenvolvimento")}>
                Configurar 2FA
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  placeholder="Confirme a nova senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                {isChangingPassword ? "Alterando..." : "Alterar Senha"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
