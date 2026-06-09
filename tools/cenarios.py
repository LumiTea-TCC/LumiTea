"""
LumiTEA — utilitário em Python para o catálogo de cenários de Roleplay.

Uso:
    python tools/cenarios.py validar
    python tools/cenarios.py listar
    python tools/cenarios.py markdown > CENARIOS.md
    python tools/cenarios.py stats

O script extrai o array CENARIOS de roleplay.html, valida campos
obrigatorios e gera relatorios. Nao depende de bibliotecas externas.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
ROLEPLAY = ROOT / "roleplay.html"

CAMPOS_OBRIG = ["id", "nome", "nivel", "tags", "desc", "objetivos",
                "contexto", "personagem", "sysprompt"]
NIVEIS_VALIDOS = {"facil", "medio", "dificil"}


def extrair_cenarios(html: str) -> list[dict]:
    """Extrai o array JS CENARIOS e converte para lista de dicts Python."""
    m = re.search(r"const\s+CENARIOS\s*=\s*\[", html)
    if not m:
        raise RuntimeError("Array CENARIOS nao encontrado em roleplay.html")

    inicio = m.end() - 1  # posicao do '['
    profundidade = 0
    fim = None
    for i in range(inicio, len(html)):
        c = html[i]
        if c == "[":
            profundidade += 1
        elif c == "]":
            profundidade -= 1
            if profundidade == 0:
                fim = i + 1
                break
    if fim is None:
        raise RuntimeError("Fim do array CENARIOS nao encontrado")

    bruto = html[inicio:fim]
    py = converter_js_para_json(bruto)
    try:
        return json.loads(py)
    except json.JSONDecodeError as e:
        ctx = py[max(0, e.pos - 60): e.pos + 60]
        raise RuntimeError(f"Falha ao parsear JSON: {e}\nContexto: ...{ctx}...")


def converter_js_para_json(src: str) -> str:
    """Converte literal de array JS para JSON valido (chaves entre aspas,
    troca de aspas simples por duplas, remocao de virgulas penduradas)."""
    out = []
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        # strings com aspas simples -> duplas, escapando aspas internas
        if c == "'":
            j = i + 1
            buf = []
            while j < n and src[j] != "'":
                if src[j] == "\\" and j + 1 < n:
                    buf.append(src[j:j + 2])
                    j += 2
                    continue
                if src[j] == '"':
                    buf.append('\\"')
                else:
                    buf.append(src[j])
                j += 1
            out.append('"' + "".join(buf) + '"')
            i = j + 1
            continue
        # strings com aspas duplas: copia literal
        if c == '"':
            j = i + 1
            while j < n and src[j] != '"':
                if src[j] == "\\" and j + 1 < n:
                    j += 2
                    continue
                j += 1
            out.append(src[i:j + 1])
            i = j + 1
            continue
        # comentarios // ate fim de linha
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        # comentarios /* ... */
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            i = (j + 2) if j != -1 else n
            continue
        out.append(c)
        i += 1

    texto = "".join(out)
    # chaves de objeto sem aspas: { id: ... } -> { "id": ... }
    texto = re.sub(r"([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:",
                   r'\1"\2":', texto)
    # virgulas penduradas antes de } ou ]
    texto = re.sub(r",(\s*[}\]])", r"\1", texto)
    return texto


def validar(cenarios: list[dict]) -> list[str]:
    erros = []
    ids = Counter()
    for idx, c in enumerate(cenarios):
        tag = f"[#{idx} id={c.get('id', '?')}]"
        for campo in CAMPOS_OBRIG:
            if campo not in c or c[campo] in (None, "", []):
                erros.append(f"{tag} campo obrigatorio ausente: {campo}")
        nivel = c.get("nivel")
        if nivel and nivel not in NIVEIS_VALIDOS:
            erros.append(f"{tag} nivel invalido: {nivel}")
        sp = c.get("sysprompt", "")
        if sp and len(sp) < 80:
            erros.append(f"{tag} sysprompt muito curto ({len(sp)} chars)")
        objs = c.get("objetivos") or []
        if len(objs) < 2:
            erros.append(f"{tag} precisa de pelo menos 2 objetivos")
        ids[c.get("id")] += 1
    for cid, qt in ids.items():
        if qt > 1:
            erros.append(f"id duplicado: {cid} ({qt}x)")
    return erros


def cmd_validar(cenarios):
    erros = validar(cenarios)
    if not erros:
        print(f"OK — {len(cenarios)} cenarios validos.")
        return 0
    print(f"FALHA — {len(erros)} problema(s) em {len(cenarios)} cenarios:")
    for e in erros:
        print(" -", e)
    return 1


def cmd_listar(cenarios):
    for c in cenarios:
        tags = ",".join(c.get("tags", []))
        print(f"[{c['nivel']:7}] {c['id']:14} {c['nome']:35} tags={tags}")
    return 0


def cmd_stats(cenarios):
    niveis = Counter(c["nivel"] for c in cenarios)
    tags = Counter(t for c in cenarios for t in c.get("tags", []))
    print(f"Total: {len(cenarios)} cenarios")
    print("Por nivel:")
    for k, v in niveis.most_common():
        print(f"  {k:8} {v}")
    print("Por tag:")
    for k, v in tags.most_common():
        print(f"  {k:14} {v}")
    return 0


def cmd_markdown(cenarios):
    print("# Cenarios de Roleplay — LumiTEA\n")
    print(f"Total: **{len(cenarios)}** cenarios disponiveis.\n")
    for nivel in ("facil", "medio", "dificil"):
        grupo = [c for c in cenarios if c["nivel"] == nivel]
        if not grupo:
            continue
        print(f"## Nivel: {nivel} ({len(grupo)})\n")
        for c in grupo:
            print(f"### {c['nome']}")
            print(f"- **id:** `{c['id']}`")
            print(f"- **tags:** {', '.join(c.get('tags', []))}")
            print(f"- **personagem:** {c['personagem'].get('nome', '?')}"
                  f" — {c['personagem'].get('descricao', '')}")
            print(f"- **descricao:** {c['desc']}")
            print(f"- **objetivos:**")
            for o in c.get("objetivos", []):
                print(f"  - {o}")
            print()
    return 0


COMANDOS = {
    "validar": cmd_validar,
    "listar": cmd_listar,
    "stats": cmd_stats,
    "markdown": cmd_markdown,
}


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in COMANDOS:
        print(__doc__)
        return 2
    html = ROLEPLAY.read_text(encoding="utf-8")
    cenarios = extrair_cenarios(html)
    return COMANDOS[argv[1]](cenarios)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
