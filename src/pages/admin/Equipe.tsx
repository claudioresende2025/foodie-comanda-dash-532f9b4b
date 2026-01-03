import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Users, Trash2, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { membroEquipeSchema, validateForm } from "@/utils/validation";

// Tipo local que inclui motoboy (será sincronizado quando executar migration no Supabase)
type AppRole = Database["public"]["Enums"]["app_role"] | "motoboy";

const roleLabels: Record<string, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  garcom: "Garçom",
  caixa: "Caixa",
  motoboy: "Motoboy",
};

const roleColors: Record<string, string> = {
  proprietario: "bg-purple-500",
  gerente: "bg-blue-500",
  garcom: "bg-green-500",
  caixa: "bg-orange-500",
  motoboy: "bg-yellow-500",
};

type ProfileWithRoles = {
  id: string;
  nome: string | null;
  email: string | null;
  empresa_id: string | null;
  user_roles?: { role: string }[] | null;
};

export default function Equipe() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    email: "",
    nome: "",
    role: "" as AppRole,
    senha: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Busca membros da equipe pela empresa_id do perfil atual.
   * Mantém o fluxo original (duas consultas) para maior compatibilidade,
   * evitando depender de relacionamentos configurados no PostgREST.
   */
  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members", profile?.empresa_id],
    queryFn: async (): Promise<ProfileWithRoles[]> => {
      if (!profile?.empresa_id) return [];

      // 1) Buscar perfis da empresa
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("empresa_id", profile.empresa_id);

      if (profilesError) throw profilesError;

      // 2) Buscar roles de cada perfil (N+1 simples e compatível)
      const profilesWithRoles: ProfileWithRoles[] = await Promise.all(
        (profiles || []).map(async (p) => {
          const { data: roles, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", p.id)
            .eq("empresa_id", profile.empresa_id!);

          if (rolesError) {
            // Se der erro em roles, não quebramos a listagem inteira
            console.error("Erro buscando roles do usuário", p.id, rolesError);
          }

          return { ...p, user_roles: roles || [] };
        }),
      );

      return profilesWithRoles;
    },
    enabled: !!profile?.empresa_id,
  });

  /**
   * Helper: garante que o perfil do novo usuário possua empresa_id.
   * - Primeiro tenta UPDATE; se nenhuma linha afetada, faz UPSERT (cria/atualiza).
   * - Inclui nome e email para manter dados sincronizados.
   */
  async function ensureProfileEmpresa(userId: string, empresaId: string, payload: { nome: string; email: string }) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("profiles")
      .update({ empresa_id: empresaId, nome: payload.nome, email: payload.email })
      .eq("id", userId)
      .select("id"); // retorna linhas afetadas

    if (updateError) throw updateError;

    const noRowsUpdated = !updatedRows || updatedRows.length === 0;
    if (noRowsUpdated) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: userId, empresa_id: empresaId, nome: payload.nome, email: payload.email }, { onConflict: "id" });
      if (upsertError) throw upsertError;
    }
  }

  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

      // Remover roles somente desta empresa
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("empresa_id", profile.empresa_id);

      if (roleError) throw roleError;

      // Remover vínculo do perfil com a empresa
      const { error: profileError } = await supabase.from("profiles").update({ empresa_id: null }).eq("id", userId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      // Invalida com a mesma chave usada no useQuery
      queryClient.invalidateQueries({ queryKey: ["team-members", profile?.empresa_id] });
      toast.success("Membro removido com sucesso!");
    },
    onError: (err: any) => {
      console.error("Erro ao remover membro:", err);
      toast.error("Erro ao remover membro");
    },
  });

  const handleCreateMember = async () => {
    // Validação com zod
    const validation = validateForm(membroEquipeSchema, {
      nome: newMember.nome.trim(),
      email: newMember.email.trim().toLowerCase(),
      senha: newMember.senha,
      role: newMember.role || undefined,
    });

    if (!validation.success) {
      (validation as { success: false; errors: string[] }).errors.forEach((error) => toast.error(error));
      return;
    }

    if (!profile?.empresa_id) {
      toast.error("Empresa não encontrada");
      return;
    }

    setIsCreating(true);

    try {
      // Salvar sessão atual (do proprietário/gerente) antes do signUp
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      // Criar usuário via Supabase Auth (isso faz login como o novo usuário)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newMember.email,
        password: newMember.senha,
        options: {
          data: {
            nome: newMember.nome,
          },
        },
      });

      if (authError) {
        if (authError.message?.includes("already registered")) {
          toast.error("Este email já está cadastrado no sistema");
        } else {
          throw authError;
        }
        return;
      }

      const newUserId = authData.user?.id;
      if (!newUserId) {
        throw new Error("Erro ao criar usuário");
      }

      // Restaurar sessão original do usuário atual
      if (currentSession) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        });
      }

      // >>> Correção definitiva: garantir empresa_id no perfil (update + upsert se necessário)
      await ensureProfileEmpresa(newUserId, profile.empresa_id!, {
        nome: newMember.nome,
        email: newMember.email,
      });

      // Inserir role do usuário
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: newUserId,
        empresa_id: profile.empresa_id,
        role: newMember.role as any, // 'motoboy' precisa existir no enum do Supabase
      });

      if (roleError) {
        // Mensagem mais amigável se o enum não tiver 'motoboy'
        const msg = roleError.message?.toLowerCase() || "";
        if (msg.includes("invalid input value for enum") || msg.includes("enum")) {
          toast.error("Função selecionada não está cadastrada na base (enum). Atualize o enum app_role no Supabase.");
        }
        throw roleError;
      }

      toast.success("Membro criado com sucesso!");
      // Invalida a query com a chave correta
      queryClient.invalidateQueries({ queryKey: ["team-members", profile?.empresa_id] });

      // Reset form e fecha modal
      setNewMember({ email: "", nome: "", role: "" as AppRole, senha: "" });
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating member:", error);
      toast.error(error.message || "Erro ao criar membro");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
          <p className="text-muted-foreground">Gerencie os membros da sua equipe</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Membro
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Membro</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={newMember.nome}
                  onChange={(e) => setNewMember({ ...newMember, nome: e.target.value })}
                  placeholder="Nome do funcionário"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha *</Label>
                <Input
                  id="senha"
                  type="password"
                  value={newMember.senha}
                  onChange={(e) => setNewMember({ ...newMember, senha: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Função *</Label>
                <Select
                  value={newMember.role}
                  onValueChange={(value) => setNewMember({ ...newMember, role: value as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="garcom">Garçom</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="motoboy">Motoboy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={handleCreateMember} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Membro"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas por função */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(roleLabels).map(([role, label]) => {
          const count =
            members?.filter((m) => Array.isArray(m.user_roles) && m.user_roles.some((r) => r.role === role)).length ||
            0;

          return (
            <Card key={role}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full ${roleColors[role as AppRole]} flex items-center justify-center`}
                  >
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lista de membros */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {members?.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum membro cadastrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {members?.map((member) => {
                const memberRoles = Array.isArray(member.user_roles) ? member.user_roles : [];
                const role = memberRoles[0]?.role as AppRole | undefined;

                return (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">{member.nome?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium">{member.nome}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {role && <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>}
                      {role !== "proprietario" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMemberMutation.mutate(member.id)}
                          disabled={deleteMemberMutation.isPending}
                          title="Remover membro da empresa"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
