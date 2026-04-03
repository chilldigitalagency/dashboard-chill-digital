"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TH, useResizableCols } from "@/components/ui/resizable-table-head";
import type { SortDir } from "@/components/ui/resizable-table-head";
import { ClientModal } from "@/components/settings/ClientModal";
import type { ClientWithThresholds } from "@/types/client";

interface ClientsSectionProps {
  clients: ClientWithThresholds[];
}

type ClientSortKey = "roas_min" | "cpa_max" | "sales_min";

const COL_WIDTHS: Record<string, number> = {
  nombre: 220, metaAccountId: 200, roas_min: 140, cpa_max: 140, sales_min: 140, acciones: 120,
};

export function ClientsSection({ clients }: ClientsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithThresholds | null>(null);
  const [sortKey, setSortKey] = useState<ClientSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { colWidths, handleResizeStart, totalWidth } = useResizableCols(COL_WIDTHS);

  function handleSort(key: ClientSortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedClients = useMemo(() => {
    if (!sortKey) return clients;
    return [...clients].sort((a, b) => {
      const ta = a.client_thresholds?.[0];
      const tb = b.client_thresholds?.[0];
      const va = ta ? (ta[sortKey] as number) : -Infinity;
      const vb = tb ? (tb[sortKey] as number) : -Infinity;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [clients, sortKey, sortDir]);

  function handleCreate() {
    setSelectedClient(null);
    setModalOpen(true);
  }

  function handleEdit(client: ClientWithThresholds) {
    setSelectedClient(client);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrado
            {clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 bg-brand-500 hover:bg-brand-600 text-white"
        >
          <Plus className="h-4 w-4" />
          Registrar cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aún no hay clientes registrados.
          </p>
          <Button onClick={handleCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Registrar el primero
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table className="table-fixed" style={{ width: totalWidth }}>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TH colKey="nombre" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.nombre} onResizeStart={(e) => handleResizeStart(e, "nombre")}>Nombre</TH>
                <TH colKey="metaAccountId" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.metaAccountId} onResizeStart={(e) => handleResizeStart(e, "metaAccountId")}>Meta Account ID</TH>
                <TH colKey="roas_min" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.roas_min} onSort={() => handleSort("roas_min")} onResizeStart={(e) => handleResizeStart(e, "roas_min")}>ROAS mín</TH>
                <TH colKey="cpa_max" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cpa_max} onSort={() => handleSort("cpa_max")} onResizeStart={(e) => handleResizeStart(e, "cpa_max")}>CPA máx</TH>
                <TH colKey="sales_min" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.sales_min} onSort={() => handleSort("sales_min")} onResizeStart={(e) => handleResizeStart(e, "sales_min")}>Ventas mín</TH>
                <TH colKey="acciones" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.acciones} onResizeStart={(e) => handleResizeStart(e, "acciones")}>Acciones</TH>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.map((client) => {
                const threshold = client.client_thresholds?.[0];
                return (
                  <TableRow
                    key={client.id}
                    className="border-border hover:bg-accent/30 transition-colors"
                  >
                    <TableCell className="font-medium text-foreground">
                      {client.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {client.meta_account_id}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {threshold ? `${threshold.roas_min}x` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {threshold ? `$${threshold.cpa_max}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {threshold ? threshold.sales_min : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(client)}
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ClientModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        client={selectedClient}
      />
    </div>
  );
}
