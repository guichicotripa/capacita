"use client";

import { useState } from "react";
import { criarUsuario } from "@/lib/actions";

type Cliente = { id: number; nome: string };

// Form para o admin cadastrar um novo usuário. Recolhível para não poluir a tela.
export function FormNovoUsuario({ clientes }: { clientes: Cliente[] }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        + Novo usuário
      </button>
    );
  }

  return (
    <form
      action={criarUsuario}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 className="font-medium">Novo usuário</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="nome" rotulo="Nome" />
        <Campo nome="email" rotulo="Email" tipo="email" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
          <select
            name="clienteId"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Sem cliente (admin)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Papel</label>
          <select
            name="papel"
            defaultValue="aluno"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="aluno">Aluno</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <Campo
        nome="senhaInicial"
        rotulo="Senha inicial (mín. 8 — o usuário troca no 1º acesso)"
        tipo="text"
      />
      <div className="flex gap-2">
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Criar e enviar acesso
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({
  nome,
  rotulo,
  tipo = "text",
}: {
  nome: string;
  rotulo: string;
  tipo?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</label>
      <input
        name={nome}
        type={tipo}
        required
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
    </div>
  );
}
