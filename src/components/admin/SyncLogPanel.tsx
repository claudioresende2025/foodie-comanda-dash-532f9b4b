/**
 * SyncLogPanel - Painel de Logs de Sincronização
 * 
 * Exibe logs de sincronização para debug e suporte técnico.
 * Pode ser incluído em uma página de configurações ou suporte.
 * 
 * Uso:
 * <SyncLogPanel />
 * 
 * Com filtro inicial:
 * <SyncLogPanel table="pedidos" errorsOnly />
 */

import { useState, useCallback } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  Trash2, 
  Download, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Database,
  Filter
} from 'lucide-react';
import { useSyncLogger } from '@/hooks/useSyncLogger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface SyncLogPanelProps {
  /** Filtrar por tabela específica */
  table?: string;
  /** Mostrar apenas erros */
  errorsOnly?: boolean;
  /** Limite de logs */
  limit?: number;
  /** Esconder header */
  hideHeader?: boolean;
  /** Altura máxima em pixels */
  maxHeight?: number;
}

export function SyncLogPanel({
  table: initialTable,
  errorsOnly: initialErrorsOnly = false,
  limit = 100,
  hideHeader = false,
  maxHeight = 400,
}: SyncLogPanelProps) {
  const [selectedTable, setSelectedTable] = useState<string>(initialTable || 'all');
  const [showErrorsOnly, setShowErrorsOnly] = useState(initialErrorsOnly);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { logs, errors, stats, clear, exportLogs } = useSyncLogger({
    table: selectedTable === 'all' ? undefined : selectedTable,
    errorsOnly: showErrorsOnly,
    limit,
  });

  const displayLogs = showErrorsOnly ? errors : logs;

  const tables = [
    { value: 'all', label: 'Todas as Tabelas' },
    { value: 'connection', label: 'Conexão' },
    { value: 'pedidos', label: 'Pedidos' },
    { value: 'comandas', label: 'Comandas' },
    { value: 'mesas', label: 'Mesas' },
    { value: 'produtos', label: 'Produtos' },
    { value: 'vendas_concluidas', label: 'Vendas' },
    { value: 'chamadas_garcom', label: 'Chamadas' },
  ];

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const handleExport = useCallback(() => {
    const data = exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs exportados com sucesso!');
  }, [exportLogs]);

  const handleClear = useCallback(() => {
    if (confirm('Tem certeza que deseja limpar todos os logs?')) {
      clear();
      toast.info('Logs limpos');
    }
  }, [clear]);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, string> = {
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };
    return variants[level] || variants.info;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return isToday ? 'Hoje' : date.toLocaleDateString('pt-BR');
  };

  return (
    <Card className="w-full">
      {!hideHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Log de Sincronização
              </CardTitle>
              <CardDescription className="mt-1">
                {stats.totalLogs} logs | {stats.errors} erros | {stats.successes} sucessos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" />
                Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent className={hideHeader ? 'pt-4' : ''}>
        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por tabela" />
            </SelectTrigger>
            <SelectContent>
              {tables.map(table => (
                <SelectItem key={table.value} value={table.value}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showErrorsOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowErrorsOnly(!showErrorsOnly)}
          >
            <AlertCircle className="w-4 h-4 mr-1" />
            Apenas Erros ({stats.errors})
          </Button>
        </div>

        {/* Lista de Logs */}
        <div 
          className="space-y-2 overflow-y-auto pr-2"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {displayLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum log encontrado</p>
              {showErrorsOnly && <p className="text-sm">Tente desativar o filtro de erros</p>}
            </div>
          ) : (
            displayLogs.map(entry => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border transition-colors ${
                  entry.level === 'error' 
                    ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' 
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {getLogIcon(entry.level)}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${getLevelBadge(entry.level)}`}>
                          {entry.table}
                        </Badge>
                        <span className="text-sm font-medium">{entry.message}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(entry.timestamp)} às {formatTime(entry.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  {entry.details && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(entry.id)}
                      className="h-6 w-6 p-0"
                    >
                      {expandedLogs.has(entry.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Detalhes expandidos */}
                {entry.details && expandedLogs.has(entry.id) && (
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-x-auto">
                    <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Rodapé com última atualização */}
        {stats.lastSync && (
          <div className="mt-4 pt-2 border-t text-xs text-gray-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Última sincronização bem-sucedida: {new Date(stats.lastSync).toLocaleString('pt-BR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SyncLogPanel;
