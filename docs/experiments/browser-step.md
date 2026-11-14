# Browser STEP feasibility prototype — 2026-11-14

**Verdict:** STEP conversion can run in a browser Web Worker using WebAssembly, without a backend or a paid Cloudflare container. This is an experiment, not enabled on model.white-box.cc.

## Reproduce

On the `prototype/browser-step` branch:

```sh
npm ci
npm run build:step-prototype
npx vite preview --config vite.step-prototype.config.js --host 127.0.0.1 --port 5182
```

Open http://127.0.0.1:5182/step-prototype.html. Choose a STEP, STL, or 3MF and the target format. The prototype shows timing, output size, bounds, volume, validity, and WASM linear memory size; it supports cancellation and a 120-second timeout.

In another terminal, with Playwright Chromium available:

```sh
node tests/step-prototype-fixtures.mjs
node tests/step-prototype.mjs
```

Fixtures are generated analytically and stored in `/private/tmp/model-step-prototype`. No user models are part of this experiment. Raw measurements are in [browser-step-results.json](browser-step-results.json).

## Evidence

- STEP → STL and STEP → 3MF completed in a browser worker.
- STL → STEP and 3MF → STEP completed for a closed box, with solid validity and STEP reimport checks.
- A 10 × 20 × 30 mm box retained its dimensions and volume of 6,000 mm³.
- A two-solid STEP compound was read successfully. The prototype's STEP → 3MF path currently merges mesh grouping through an intermediate STL; it does **not** preserve the source assembly structure.
- A 4,542-face torus mesh → STEP took about 2.4 seconds; output was 10.7 MB.
- A 14,964-face torus mesh → STEP took about 7.8 seconds; output was 34.9 MB; WASM linear memory grew to 334,102,528 bytes (about 319 MiB).
- Open meshes and inputs over the 20,000-face experimental STEP-output cap were rejected. Degenerate triangles are conservatively rejected too; an OCCT sphere tessellation exposed this limitation.
- Browser traffic during conversion was limited to same-origin GET requests for application assets. Model contents were not uploaded.
- Existing browser mesh tests and the production free build still pass. The production build does not include the WASM prototype.

These are local desktop Chromium results, not mobile compatibility tests, production cold-download timings, or total browser peak-memory measurements. WASM linear memory is only one part of process memory.

## Packaging

`occt-wasm` 5.17.1 provides both STEP input and output. The emitted WASM is 21,343,770 bytes (~21.3 MB); Vite estimates gzip at ~6.8 MB. Load it only for STEP operations. The initial linear memory allocation observed in this build is 128 MiB, leaving no practical room inside a 128 MB Cloudflare Worker isolate. Cloudflare can instead host the static assets while the user's device runs the kernel.

The build logs a warning about the package's guarded Node.js `node:module` import. The tested browser worker path does not execute it. Browser compatibility beyond the tested Chromium requires validation.

## Next implementation steps

1. Ship STEP → STL / 3MF first, with independent input-size and output-face limits, lazy WASM loading, progress phases, timeout and cancellation.
2. Preserve STEP solid/assembly grouping directly when writing 3MF instead of routing it through STL.
3. Validate millimeter/inch STEP inputs, nested assemblies, invalid files, curved surfaces and real-world CAD exports with an independent native CAD reader.
4. Exercise Safari/WebKit, Firefox and memory-constrained devices. The kernel requires modern WASM features.
5. Expose mesh → STEP as experimental, initially with a low face cap. Handle multi-shell solids, cavities, degeneracy and normals before raising that cap.
6. Include the OCCT license notices and corresponding-source/relinking provisions required when distributing the WASM binary; the wrapper and OCCT have different licenses.

Do not market mesh → STEP as recovering analytic curves or parametric modeling history. A million-face input can produce a very large STEP and exhaust device memory; the current 3-million-face mesh-only limit is not a suitable STEP-output limit.

## Sources

- https://github.com/andymai/occt-wasm — API, browser compatibility, build and source.
- https://developers.cloudflare.com/workers/platform/limits/ — Worker resource limits.
- https://github.com/kovacsv/occt-import-js — alternative import-only CAD reader considered; not selected for this two-way prototype.
