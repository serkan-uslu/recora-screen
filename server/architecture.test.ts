import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

test("React views depend on controllers, never command transports or native APIs", () => {
  for (const file of readdirSync("src", { recursive: true }).filter(
    (file) => typeof file === "string" && file.endsWith(".tsx"),
  )) {
    const source = ts.createSourceFile(
      String(file),
      readFileSync(`src/${file}`, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    for (const node of source.statements) {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier)
      )
        continue;
      assert.doesNotMatch(
        node.moduleSpecifier.text,
        /(?:^@tauri|\/(?:api$|infrastructure\/|services\/|server\/))/,
        `${file} must route side effects through a controller`,
      );
    }
  }
});
