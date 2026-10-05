import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["ar", "fr"];
const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(root, "src", "i18n", "messages", `${locale}.json`), "utf8"))
  ])
);
const issues = [];

function visit(value, path, callback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    callback(path, value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(child, path ? `${path}.${key}` : key, callback);
  }
}

const keySets = Object.fromEntries(
  locales.map((locale) => {
    const paths = new Set();
    visit(messages[locale], "", (path) => paths.add(path));
    return [locale, paths];
  })
);

for (const path of keySets.ar) {
  if (!keySets.fr.has(path)) issues.push(`Missing in fr.json: ${path}`);
}

// Verify statically referenced next-intl keys too. Matching locale JSON trees
// alone will not catch a typo such as tCommon("closse") in a component.
const sourceFiles = [];
function collectSourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(absolutePath);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(absolutePath);
  }
}
collectSourceFiles(join(root, "src"));

function unwrap(node) {
  while (node && (ts.isAwaitExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression(node))) {
    node = node.expression;
  }
  return node;
}

function staticString(node) {
  node = unwrap(node);
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  return undefined;
}

function getTranslationNamespace(call, sourceFile) {
  if (!call || !ts.isCallExpression(call)) return undefined;
  const callee = call.expression;
  const functionName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
  if (functionName !== "useTranslations" && functionName !== "getTranslations") return undefined;

  const firstArgument = unwrap(call.arguments[0]);
  const directNamespace = staticString(firstArgument);
  if (directNamespace !== undefined) return directNamespace;
  if (firstArgument && ts.isObjectLiteralExpression(firstArgument)) {
    for (const property of firstArgument.properties) {
      if (!ts.isPropertyAssignment(property) || property.name.getText(sourceFile).replaceAll(/["']/g, "") !== "namespace") continue;
      return staticString(property.initializer);
    }
    return "";
  }
  return firstArgument ? undefined : "";
}

function hasTranslation(locale, key) {
  let value = messages[locale];
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, part)) return false;
    value = value[part];
  }
  return typeof value === "string";
}

for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const translatorNamespaces = new Map();

  function inspect(node) {
    if (ts.isVariableDeclaration(node)) {
      const initializer = unwrap(node.initializer);
      if (ts.isIdentifier(node.name) && initializer && ts.isCallExpression(initializer)) {
        const namespace = getTranslationNamespace(initializer, sourceFile);
        if (namespace !== undefined) translatorNamespaces.set(node.name.text, namespace);
      } else if (node.name.kind === ts.SyntaxKind.ArrayBindingPattern && initializer && ts.isCallExpression(initializer) && ts.isPropertyAccessExpression(initializer.expression) && initializer.expression.expression.getText(sourceFile) === "Promise" && initializer.expression.name.text === "all") {
        const values = unwrap(initializer.arguments[0]);
        if (values && ts.isArrayLiteralExpression(values)) {
          node.name.elements.forEach((element, index) => {
            const namespace = values.elements[index] && getTranslationNamespace(unwrap(values.elements[index]), sourceFile);
            if (ts.isBindingElement(element) && ts.isIdentifier(element.name) && namespace !== undefined) translatorNamespaces.set(element.name.text, namespace);
          });
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && translatorNamespaces.has(node.expression.text)) {
      const keyPart = staticString(node.arguments[0]);
      if (keyPart !== undefined) {
        const namespace = translatorNamespaces.get(node.expression.text);
        const key = namespace ? `${namespace}.${keyPart}` : keyPart;
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        for (const locale of locales) {
          if (!hasTranslation(locale, key)) issues.push(`Missing ${locale} translation referenced in ${file}:${line + 1}: ${key}`);
        }
      }
    }
    ts.forEachChild(node, inspect);
  }

  inspect(sourceFile);
}
for (const path of keySets.fr) {
  if (!keySets.ar.has(path)) issues.push(`Missing in ar.json: ${path}`);
}

const placeholders = (value) => [...String(value).matchAll(/\{([\w.-]+)\}/g)].map((match) => match[1]).sort();
const arLeaves = new Map();
const frLeaves = new Map();
visit(messages.ar, "", (path, value) => arLeaves.set(path, value));
visit(messages.fr, "", (path, value) => frLeaves.set(path, value));

for (const path of keySets.ar) {
  if (!keySets.fr.has(path)) continue;
  const arVariables = placeholders(arLeaves.get(path)).join(",");
  const frVariables = placeholders(frLeaves.get(path)).join(",");
  if (arVariables !== frVariables) {
    issues.push(`Interpolation mismatch at ${path}: ar={${arVariables}} fr={${frVariables}}`);
  }
}

if (issues.length) {
  console.error(`Locale check failed (${issues.length} issue${issues.length === 1 ? "" : "s"}):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Locale message trees match (${keySets.ar.size} entries; ar, fr).`);
}
