// Emberwild entry program: copies game/ and screenshots/ into the output
// directory and writes the dossier with the kit's buildDossier. Node 22
// standard library only; running it twice writes identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// NOTE (16 Nov 2026): do NOT rmSync the output dir first. In the grader
// /output is a mount point, and rmSync(mount, {recursive:true, force:true})
// throws EBUSY ("Device or resource busy") when it tries to rmdir the mount
// itself — force:true only ignores ENOENT. That crash was the round-1
// run_completes failure: main.ts died before copying anything. The grader
// hands us a fresh /output, so mkdirSync + cpSync is all that is needed
// (same as the kit starter and the passing threejs-fps-02 entry).
mkdirSync(outputDir, { recursive: true });

const gameSource = join(repoRoot, 'game');
cpSync(gameSource, join(outputDir, 'game'), { recursive: true });

const shotsSource = join(repoRoot, 'screenshots');
if (existsSync(shotsSource)) {
  cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
