#!/usr/bin/env python3
"""
extract-symbols.py — Repo Map Lite 符号提取器
用法: python3 scripts/extract-symbols.py <file>
输出: JSON { lang, defines: [...], calls: [...], imports: [...] }

支持: shell(.sh) / python(.py) / js/ts/mjs(.js .ts .mjs)
设计原则: 零外部依赖，精度够用即可 (80% 覆盖真实场景)。
"""
import sys, re, json

def extract_shell(src):
    defines, calls, imports = [], [], []
    # 函数定义: fname() / function fname / fname () {
    fn_re = re.compile(r'^(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*\{?', re.MULTILINE)
    for m in fn_re.finditer(src):
        name = m.group(1)
        # 排除 if/while/for/case 等关键字
        if name not in ('if','while','for','case','do','then','else','fi','esac','done','in'):
            defines.append(name)
    # 调用: 行首或赋值后出现的 bash fname 或直接 fname
    call_re = re.compile(r'(?:^|\s)(?:bash\s+\S+/)?([a-zA-Z_][a-zA-Z0-9_]*)\s', re.MULTILINE)
    known = set(defines)
    for m in call_re.finditer(src):
        name = m.group(1)
        if name in known and name not in calls:
            calls.append(name)
    # source / . 导入
    src_re = re.compile(r'(?:source|\.) +([^\s;]+)', re.MULTILINE)
    for m in src_re.finditer(src):
        imports.append(m.group(1))
    return defines, calls, imports

def extract_python(src):
    import ast as ast_mod
    defines, calls, imports = [], [], []
    try:
        tree = ast_mod.parse(src)
    except SyntaxError:
        return defines, calls, imports
    for node in ast_mod.walk(tree):
        if isinstance(node, (ast_mod.FunctionDef, ast_mod.AsyncFunctionDef)):
            defines.append(node.name)
        elif isinstance(node, ast_mod.ClassDef):
            defines.append(node.name)
        elif isinstance(node, ast_mod.Call):
            if isinstance(node.func, ast_mod.Name):
                calls.append(node.func.id)
            elif isinstance(node.func, ast_mod.Attribute):
                calls.append(node.func.attr)
        elif isinstance(node, ast_mod.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast_mod.ImportFrom):
            if node.module:
                imports.append(node.module)
    # 去重保序
    defines = list(dict.fromkeys(defines))
    calls   = list(dict.fromkeys(c for c in calls if c not in defines))
    imports = list(dict.fromkeys(imports))
    return defines, calls, imports

def extract_js(src):
    defines, calls, imports = [], [], []
    # export function / function / const fn = / class Foo
    fn_patterns = [
        r'(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)',
        r'(?:export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)',
        r'(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\(.*?\)\s*=>)',
    ]
    for pat in fn_patterns:
        for m in re.finditer(pat, src):
            defines.append(m.group(1))
    # import from
    imp_re = re.compile(r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]')
    req_re = re.compile(r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)')
    for m in imp_re.finditer(src): imports.append(m.group(1))
    for m in req_re.finditer(src): imports.append(m.group(1))
    # 调用: fname(  排除定义行
    call_re = re.compile(r'\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(')
    known = set(defines)
    skip = {'if','while','for','switch','function','class','return','typeof','instanceof','new'}
    for m in call_re.finditer(src):
        name = m.group(1)
        if name in known and name not in skip and name not in calls:
            calls.append(name)
    defines = list(dict.fromkeys(defines))
    imports = list(dict.fromkeys(imports))
    return defines, calls, imports

def detect_lang(path):
    if path.endswith('.py'):   return 'python'
    if path.endswith('.sh') or path.endswith('kit'): return 'shell'
    if path.endswith(('.js','.mjs','.ts','.tsx')): return 'js'
    return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: extract-symbols.py <file>"}))
        sys.exit(1)
    path = sys.argv[1]
    lang = detect_lang(path)
    if not lang:
        print(json.dumps({"lang": "unknown", "defines": [], "calls": [], "imports": []}))
        return
    try:
        src = open(path, encoding='utf-8', errors='ignore').read()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    if lang == 'shell':   d, c, i = extract_shell(src)
    elif lang == 'python': d, c, i = extract_python(src)
    else:                  d, c, i = extract_js(src)

    print(json.dumps({
        "lang": lang,
        "defines": d[:50],   # 最多 50 个，防止巨型文件爆 token
        "calls": c[:50],
        "imports": i[:20]
    }, ensure_ascii=False))

if __name__ == '__main__':
    main()
