# TypeScript Toolchain — why `typescript` is pinned to 6.x

**Date:** Sep 6, 2026 · **By:** BE-2 · **Scope:** `Backend/package.json`, `Backend/tsconfig.json`
**Status:** temporary. Revert when TypeScript 7.1 ships (see §5).

---

## 1. What broke

`npm run dev` did not run. Neither did any other `ts-node` invocation:

```
TypeError: Cannot read properties of undefined (reading 'fileExists')
    at readConfig (node_modules/ts-node/dist/configuration.js:91:33)
```

It failed on every file, including a one-line script with `--skipProject`, so it was never about our code or our `tsconfig.json`.

## 2. Root cause

**TypeScript 7.0 ships no programmatic compiler API.** It is the Go port ("Corsa"): a CLI plus platform binaries (`@typescript/typescript-linux-x64` and friends), with the JS package reduced to a version stub.

```
$ node -e "const ts=require('typescript'); console.log(Object.keys(ts), ts.sys)"
[ 'version', 'versionMajorMinor' ] undefined
```

`node_modules/typescript/package.json` confirms it: `"." → "./lib/version.cjs"`, `bin` contains only `tsc` (no `tsserver`), and the real API is behind explicitly-unstable `typescript/unstable/*` subpaths whose shape differs from the old one.

`ts-node` reads `ts.sys.fileExists` in its config loader before touching user code, so it dies at startup. This is not a `ts-node` bug and not specific to us — everything built on `createProgram()` / `program.emit()` breaks identically: `ts-loader`, `ts-jest`, type-aware ESLint rules, `nest build`, the Swagger/GraphQL CLI plugins.

The TypeScript team stated it plainly: 7.0 does not ship with an API, and a **new, different** API is planned for **7.1**. `typescript@6.0.3` is the last API-bearing release.

## 3. What changed

| File | Change | Why |
|---|---|---|
| `package.json` | `typescript` `^7.0.2` → `^6.0.3` (devDep) | the package in `node_modules` must carry the compiler API for `ts-node` to load |
| `package.json` | new `"typecheck": "npx -p typescript@7 tsc --noEmit"` | keeps type checking on the native TS 7 compiler |
| `package.json` | new `"selfcheck": "ts-node src/models/selfcheck.ts"` | runs the model invariant checks |
| `tsconfig.json` | added `"types": ["node"]` | `ts-node` compiles files in isolation and, unlike `tsc`, does not pick `@types/node` up from the `include` globs — without this it reports `Cannot find name 'console' / 'process'` |

`"dev"`, `"build"` and `"start"` are untouched.

**The one rule:** never let TypeScript 7 land in `node_modules/typescript`. `ts-node` resolves the package from there and fails. TS 7 is reachable only through `npx -p typescript@7`, which npm caches after the first run.

## 4. Why not the alternatives

| Option | Rejected because |
|---|---|
| `tsx` (esbuild runner) | works, but routes around TypeScript entirely — you lose TS 7, which was the point of being on it. Also a new dep and it displaces `nodemon`. |
| Pin `typescript@5.9` | works (verified: `tsc --noEmit` exit 0), but gives up the native compiler for no gain over 6.x |
| Node's native TS execution | Node 26 treats the files as ESM, so extensionless `./index` imports fail; `--experimental-transform-types`, which handles `User.ts`'s `enum`, is gone from this Node |
| Wait for 7.1 | leaves `npm run dev` broken indefinitely |

## 5. Reverting

`npm dist-tags` already shows `next: 7.1.0-dev.20260906.1` — 7.1 dev builds publish daily, so this should be short-lived. When 7.1 releases **and** `ts-node` (or its replacement) supports the new API:

1. `npm i -D typescript@^7.1`
2. delete the `typecheck` script — `build` covers it again
3. keep `"types": ["node"]`; it is correct regardless

## 6. Verification

All three pass as of this commit:

```bash
cd Backend
npm run build       # tsc, TypeScript 6.0.3
npm run typecheck   # tsc --noEmit, TypeScript 7.0.2
npm run selfcheck   # ts-node → "models selfcheck: all assertions passed"
```

## 7. Still open (BE-1)

~~`Backend/src/index.ts` does not exist, so `npm run dev` has no entrypoint to run.~~ **Resolved later the same day:** BE-2 wrote it, and after the microservices split it is the API gateway. `npm run dev` runs the gateway; each service has its own.

## 8. Note on the spec

`SystemDesignDocs/BGSC Platform — Complete Feature Specification & Architecture.md` names **NestJS** at lines 229 and 2345 (two table cells, no elaboration anywhere else). The backend is Express 5 + Mongoose. Nothing here depends on that being resolved, but the stale cells are worth striking so they stop resurfacing in tooling decisions — NestJS would also be blocked by this same TS 7 issue, since `@nestjs/cli@12` depends on `typescript ~6.0.2` and peers on `ts-loader`.

Database is settled and not in question: `MVP_Timeline_Plan_Updated.md:89` "Relational → Non-Relational (NoSQL)", `:811` MongoDB.

## References

- [Does NestJS work with TypeScript 7 (tsgo)?](https://fernforge.github.io/devnotes/nestjs-typescript-7/) — the two-version pattern, list of broken tools
- [Support for TypeScript 7 · TypeStrong/ts-loader#1702](https://github.com/TypeStrong/ts-loader/issues/1702)
- [TypeScript 7 progress — InfoQ](https://www.infoq.com/news/2026/01/typescript-7-progress)
