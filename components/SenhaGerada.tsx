"use client";

import { useEffect, useState } from "react";
import { useDict } from "./I18nProvider";

// Gera uma senha forte no cliente (crypto.getRandomValues) que satisfaz a política
// do servidor (14+ com maiúscula/minúscula/dígito/especial). O admin não digita
// senha: ela é gerada, mostrada mascarada com copiar/revelar, e vai por email.
function gerar(tam = 16): string {
  const minus = "abcdefghijkmnpqrstuvwxyz";
  const maius = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const esp = "!@#$%&*?-_+=";
  const todos = minus + maius + nums + esp;
  const rnd = (n: number) => {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  };
  const pick = (s: string) => s[rnd(s.length)];
  const chars = [pick(minus), pick(maius), pick(nums), pick(esp)];
  while (chars.length < Math.max(tam, 14)) chars.push(pick(todos));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function SenhaGerada({ name }: { name: string }) {
  const d = useDict();
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Gera no cliente após montar (evita divergência de hidratação).
  useEffect(() => setSenha(gerar()), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Clipboard bloqueado: mostra a senha para cópia manual.
      setMostrar(true);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {d.admin.usuarios.senhaInicial}
      </label>
      <div className="flex items-stretch gap-1.5">
        <input
          type={mostrar ? "text" : "password"}
          value={senha}
          readOnly
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none"
        />
        <input type="hidden" name={name} value={senha} />
        <button
          type="button"
          onClick={() => setMostrar((m) => !m)}
          className="rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          {mostrar ? d.admin.usuarios.ocultar : d.admin.usuarios.mostrar}
        </button>
        <button
          type="button"
          onClick={copiar}
          className="rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          {copiado ? d.admin.usuarios.copiado : d.admin.usuarios.copiar}
        </button>
        <button
          type="button"
          onClick={() => setSenha(gerar())}
          className="rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          {d.admin.usuarios.gerarNova}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">{d.admin.usuarios.senhaGeradaAjuda}</p>
    </div>
  );
}
