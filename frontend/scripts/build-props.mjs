// Builds components/props.generated.json: for every component, its props (name, type, required, description) read from the
// exported `<Name>Props` type and its JSDoc. The props table in the gallery and the CI check on descriptions both read it, so the
// table cannot drift from the code (BRD 1.2 5.2 anatomy: a component is a typed unit that receives data and configuration as props).
import ts from 'typescript';
import { readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../components/', import.meta.url).pathname;
const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !/\.(test|manifest|stories)\./.test(f) && f !== 'index.ts' && f !== 'manifests.ts' && f !== 'manifest.ts') files.push(p);
  }
};
walk(root);

const program = ts.createProgram(files, { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, skipLibCheck: true, noEmit: true });
const checker = program.getTypeChecker();
const out = {};
for (const file of files) {
  const sf = program.getSourceFile(file);
  ts.forEachChild(sf, (node) => {
    const isProps = (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && /Props$/.test(node.name.text) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isProps) return;
    const component = node.name.text.replace(/Props$/, '');
    const type = checker.getTypeAtLocation(node.name);
    const props = checker.getPropertiesOfType(type).map((sym) => {
      const decl = sym.declarations?.[0];
      const t = decl ? checker.getTypeOfSymbolAtLocation(sym, decl) : checker.getTypeOfSymbol(sym);
      const description = ts.displayPartsToString(sym.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
      return {
        name: sym.name,
        type: checker.typeToString(t, decl, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope).replace(/ \| undefined$/, ''),
        required: !(sym.flags & ts.SymbolFlags.Optional),
        description,
      };
    });
    out[component] = { file: relative(join(root, '..'), file), props };
  });
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(new URL('../components/props.generated.json', import.meta.url), JSON.stringify(sorted, null, 2) + '\n');
const total = Object.values(sorted).reduce((n, c) => n + c.props.length, 0);
const missing = Object.entries(sorted).flatMap(([c, v]) => v.props.filter((p) => !p.description).map((p) => `${c}.${p.name}`));
console.log(`props: ${Object.keys(sorted).length} components, ${total} props, ${missing.length} without a description`);
if (process.argv.includes('--list')) console.log(missing.join('\n'));
