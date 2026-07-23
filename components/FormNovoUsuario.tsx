"use client";

import { useState } from "react";
import { criarUsuario } from "@/lib/actions";
import { useDict } from "./I18nProvider";
import { SenhaGerada } from "./SenhaGerada";

type Cliente = { id: number; nome: string };

// Form para o admin cadastrar um novo usuário. Recolhível para não poluir a tela.
// full = admin geral (escolhe cliente e papel); admin de cliente só cria aluno no seu cliente.
export function FormNovoUsuario({ clientes, full = true }: { clientes: Cliente[]; full?: boolean }) {
  const d = useDict();
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {d.admin.usuarios.novoUsuario}
      </button>
    );
  }

  return (
    <form
      action={criarUsuario}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 className="font-medium">{d.admin.usuarios.novoTitulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="nome" rotulo={d.admin.usuarios.nome} />
        <Campo nome="email" rotulo={d.admin.usuarios.email} tipo="email" />
      </div>
      {/* Contato e cargo: opcionais, para o cadastro da pessoa ficar completo. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="telefone" rotulo={d.admin.usuarios.telefone} tipo="tel" obrigatorio={false} />
        <Campo nome="cargo" rotulo={d.admin.usuarios.cargo} obrigatorio={false} />
      </div>
      {/* Cliente e papel só para o admin geral; admin de cliente cria aluno no seu cliente. */}
      {full && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{d.admin.usuarios.cliente}</label>
            <select
              name="clienteId"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">{d.admin.usuarios.semCliente}</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{d.admin.usuarios.papel}</label>
            <select
              name="papel"
              defaultValue="aluno"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="aluno">{d.admin.usuarios.aluno}</option>
              <option value="admin">{d.admin.usuarios.admin}</option>
            </select>
          </div>
        </div>
      )}
      <SenhaGerada name="senhaInicial" />
      <div className="flex gap-2">
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {d.admin.usuarios.criarEnviar}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {d.admin.usuarios.cancelar}
        </button>
      </div>
    </form>
  );
}

function Campo({
  nome,
  rotulo,
  tipo = "text",
  obrigatorio = true,
}: {
  nome: string;
  rotulo: string;
  tipo?: string;
  obrigatorio?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</label>
      <input
        name={nome}
        type={tipo}
        required={obrigatorio}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
    </div>
  );
}
