import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export function buildUpdateWorker() {
  let out;
  return {
    name:'build-update-worker',
    apply:'build',
    configResolved(config) {
      out = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = (await readdir(out, {recursive:true, withFileTypes:true}))
        .filter(entry => entry.isFile())
        .map(entry => resolve(entry.parentPath, entry.name))
        .filter(path => path !== resolve(out,'sw.js')).sort();
      const worker = await readFile(new URL('./sw.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(worker);
      for (const file of files) hash.update(await readFile(file));
      const assets = ['./', ...files.map(file => './' + file.slice(out.length + 1).replaceAll('\\', '/'))];
      const preamble = 'const BUILD = ' + JSON.stringify(hash.digest('hex')) + ';\nconst ASSETS = ' + JSON.stringify(assets) + ';\n';
      await writeFile(resolve(out,'sw.js'), preamble + worker);
    }
  };
}
