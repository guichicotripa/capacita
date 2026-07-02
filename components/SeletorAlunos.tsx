"use client";

import { useState } from "react";
import { useDict } from "./I18nProvider";

type Aluno = { id: number; nome: string };
type Grupo = { cliente: string; alunos: Aluno[] };

// Seleção múltipla de alunos, agrupada por cliente, com "marcar todos" por grupo.
// Cada selecionado vira um campo <input name="usuarioIds"> no submit.
export function SeletorAlunos({ grupos }: { grupos: Grupo[] }) {
  const d = useDict();
  const [sel, setSel] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleGrupo = (alunos: Aluno[], marcar: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      for (const a of alunos) {
        if (marcar) n.add(a.id);
        else n.delete(a.id);
      }
      return n;
    });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{d.admin.atribuir.alunos}</span>
        <span className="text-xs text-slate-400">{d.admin.atribuir.selecionados(sel.size)}</span>
      </div>

      {sel.size === 0 && (
        <input type="hidden" name="_semAluno" value="1" />
      )}
      {[...sel].map((id) => (
        <input key={id} type="hidden" name="usuarioIds" value={id} />
      ))}

      <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
        {grupos.map((g) => {
          const todosMarcados = g.alunos.length > 0 && g.alunos.every((a) => sel.has(a.id));
          return (
            <div key={g.cliente}>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={(e) => toggleGrupo(g.alunos, e.target.checked)}
                />
                {g.cliente} <span className="font-normal text-slate-400">({g.alunos.length})</span>
              </label>
              <div className="mt-1 space-y-1 pl-5">
                {g.alunos.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} />
                    {a.nome}
                  </label>
                ))}
                {g.alunos.length === 0 && (
                  <p className="text-xs text-slate-400">{d.admin.atribuir.semAlunos}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
