"use client";

import { useState } from "react";
import { atualizarUsuario, redefinirSenha } from "@/lib/actions";
import { useDict } from "./I18nProvider";
import { SenhaGerada } from "./SenhaGerada";

type Cliente = { id: number; nome: string };
type Usuario = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  telefone: string | null;
  cargo: string | null;
  clienteId: number | null;
  clienteNome: string | null;
};

// Linha de usuário com edição inline (infos) e redefinição de senha.
// full = admin geral (edita cliente e papel); admin de cliente edita só nome/email/senha.
export function UsuarioItem({
  usuario,
  clientes,
  full = true,
}: {
  usuario: Usuario;
  clientes: Cliente[];
  full?: boolean;
}) {
  const d = useDict();
  const [editando, setEditando] = useState(false);
  const [resetando, setResetando] = useState(false);
  const rotuloPapel = usuario.papel === "admin" ? d.admin.usuarios.admin : d.admin.usuarios.aluno;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">
            {usuario.nome}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              {rotuloPapel}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            {usuario.email} · {usuario.clienteNome ?? d.admin.usuarios.semCliente}
          </p>
          {(usuario.cargo || usuario.telefone) && (
            <p className="text-xs text-slate-400">
              {[usuario.cargo, usuario.telefone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            onClick={() => {
              setEditando((v) => !v);
              setResetando(false);
            }}
            className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
          >
            {editando ? d.admin.usuarios.fechar : d.admin.usuarios.editar}
          </button>
          <button
            onClick={() => {
              setResetando((v) => !v);
              setEditando(false);
            }}
            className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
          >
            {d.admin.usuarios.redefinirSenha}
          </button>
        </div>
      </div>

      {editando && (
        <form action={atualizarUsuario} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={usuario.id} />
          <input
            name="nome"
            defaultValue={usuario.nome}
            required
            placeholder={d.admin.usuarios.nome}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <input
            name="email"
            type="email"
            defaultValue={usuario.email}
            required
            placeholder={d.admin.usuarios.email}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <input
            name="telefone"
            type="tel"
            defaultValue={usuario.telefone ?? ""}
            placeholder={d.admin.usuarios.telefone}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <input
            name="cargo"
            defaultValue={usuario.cargo ?? ""}
            placeholder={d.admin.usuarios.cargo}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          {/* Cliente e papel só editáveis pelo admin geral. */}
          {full && (
            <>
              <select
                name="clienteId"
                defaultValue={usuario.clienteId ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">{d.admin.usuarios.semCliente}</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <select
                name="papel"
                defaultValue={usuario.papel}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="aluno">{d.admin.usuarios.aluno}</option>
                <option value="admin">{d.admin.usuarios.admin}</option>
              </select>
            </>
          )}
          <div className="sm:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              {d.admin.usuarios.salvar}
            </button>
          </div>
        </form>
      )}

      {resetando && (
        <form action={redefinirSenha} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={usuario.id} />
          <SenhaGerada name="novaSenha" />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.admin.usuarios.redefinirAvisar}
          </button>
        </form>
      )}
    </div>
  );
}
