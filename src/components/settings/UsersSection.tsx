"use client";

import { useState, useMemo } from "react";
import { KeyRound, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TH, useResizableCols } from "@/components/ui/resizable-table-head";
import type { SortDir } from "@/components/ui/resizable-table-head";
import { UserAccessModal } from "@/components/settings/UserAccessModal";
import type { Client } from "@/types/client";
import type { ProfileWithEmail } from "@/types/profile";

interface UsersSectionProps {
  users: ProfileWithEmail[];
  allClients: Client[];
  accessByUser: Record<string, string[]>;
}

type UserSortKey = "assignedCount";

const COL_WIDTHS: Record<string, number> = {
  nombre: 220, email: 250, rol: 140, assignedCount: 200, acciones: 160,
};

export function UsersSection({ users, allClients, accessByUser }: UsersSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileWithEmail | null>(null);
  const [sortKey, setSortKey] = useState<UserSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { colWidths, handleResizeStart, totalWidth } = useResizableCols(COL_WIDTHS);

  function handleSort(key: UserSortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedUsers = useMemo(() => {
    if (!sortKey) return users;
    return [...users].sort((a, b) => {
      const va = a.role === "admin" ? Infinity : (accessByUser[a.id]?.length ?? 0);
      const vb = b.role === "admin" ? Infinity : (accessByUser[b.id]?.length ?? 0);
      if (!isFinite(va) && !isFinite(vb)) return 0;
      if (!isFinite(va)) return sortDir === "desc" ? -1 : 1;
      if (!isFinite(vb)) return sortDir === "desc" ? 1 : -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [users, sortKey, sortDir, accessByUser]);

  function handleManageAccess(user: ProfileWithEmail) {
    setSelectedUser(user);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Nota informativa */}
      <div className="flex gap-3 rounded-xl border border-border bg-accent/30 px-4 py-3">
        <Info className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">
            ¿Cómo se incorporan nuevos usuarios?
          </span>{" "}
          Cualquier persona con email{" "}
          <span className="text-brand-400 font-medium">
            @chilldigital.agency
          </span>{" "}
          que inicie sesión con Google tendrá acceso automáticamente como
          operador. El rol y el acceso a clientes se configuran desde acá.
        </div>
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            {users.length} usuario{users.length !== 1 ? "s" : ""} en el equipo
          </p>
        </div>

        {users.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Aún no hay usuarios registrados. Cuando alguien del equipo inicie
              sesión por primera vez, aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table className="table-fixed" style={{ width: totalWidth }}>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TH colKey="nombre" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.nombre} onResizeStart={(e) => handleResizeStart(e, "nombre")}>Nombre</TH>
                  <TH colKey="email" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.email} onResizeStart={(e) => handleResizeStart(e, "email")}>Email</TH>
                  <TH colKey="rol" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.rol} onResizeStart={(e) => handleResizeStart(e, "rol")}>Rol</TH>
                  <TH colKey="assignedCount" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.assignedCount} onSort={() => handleSort("assignedCount")} onResizeStart={(e) => handleResizeStart(e, "assignedCount")}>Clientes asignados</TH>
                  <TH colKey="acciones" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.acciones} onResizeStart={(e) => handleResizeStart(e, "acciones")}>Acciones</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => {
                  const assignedCount = accessByUser[user.id]?.length ?? 0;
                  return (
                    <TableRow
                      key={user.id}
                      className="border-border hover:bg-accent/30 transition-colors"
                    >
                      <TableCell className="font-medium text-foreground">
                        {user.full_name ?? "Sin nombre"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className={
                            user.role === "admin"
                              ? "bg-brand-500/20 text-brand-300 border-brand-500/30 hover:bg-brand-500/20"
                              : "bg-muted text-muted-foreground hover:bg-muted"
                          }
                        >
                          {user.role === "admin" ? "Admin" : "Operador"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.role === "admin" ? (
                          <span className="text-brand-400">Todos</span>
                        ) : (
                          `${assignedCount} cliente${assignedCount !== 1 ? "s" : ""}`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageAccess(user)}
                            className="gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Gestionar acceso
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserAccessModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          user={selectedUser}
          allClients={allClients}
          currentClientIds={accessByUser[selectedUser.id] ?? []}
        />
      )}
    </div>
  );
}
