import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/Users/ljk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const output = resolve(root, 'out/svg-host-poc');
await mkdir(resolve(output, 'frames'), {recursive:true});
const types = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json', '.css':'text/css'};
const server = createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + '/')) {res.writeHead(403).end(); return;}
    const data = await readFile(path);
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream'}).end(data);
  } catch {res.writeHead(404).end();}
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser = await chromium.launch({headless:true, executablePath: process.env.CHROME_PATH || '/Users/ljk/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
  const page = await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror',e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/experiments/svg-host-poc/index.html`);
  await page.waitForFunction(() => window.svgHostReady === true);
  await page.evaluate(() => {window.pauseAnimation();window.setFrame(0);});
  const geometry = await page.evaluate(() => {
    const body=document.querySelector('#body');
    const box=body.getBBox();
    return {paths:body.querySelectorAll('path').length,width:box.width,height:box.height};
  });
  if(geometry.paths < 900 || geometry.width < 1000 || geometry.height < 1300) throw Error(`Traced body did not render: ${JSON.stringify(geometry)}`);
  await page.screenshot({path:resolve(output,'preview.png'),fullPage:true});
  const stage = page.locator(process.env.STAGE_SELECTOR || '#stage');
  const render = async frame => {
    await page.evaluate(f => window.setFrame(f),frame);
    return stage.screenshot({animations:'disabled'});
  };
  const first = await render(43);
  await render(130);
  const repeated = await render(43);
  if (!first.equals(repeated)) throw Error('Frame 43 is not deterministic');
  for (let f=0; f<240; f++) {
    const data = await render(f);
    await writeFile(resolve(output,`frames/${String(f).padStart(4,'0')}.png`),data);
    if (f%60 === 0) console.log(`Rendered ${f}/240`);
  }
  if(errors.length) throw Error(errors.join('\n'));
  const result=spawnSync('ffmpeg',['-y','-framerate','30','-i',resolve(output,'frames/%04d.png'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-crf','18',resolve(output,'animation.mp4')],{encoding:'utf8'});
  if(result.status !== 0) throw Error(result.stderr);
  const gif=spawnSync('ffmpeg',['-y','-i',resolve(output,'animation.mp4'),'-vf','fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',resolve(output,'animation.gif')],{encoding:'utf8'});
  if(gif.status !== 0) throw Error(gif.stderr);
  await writeFile(resolve(output,'render-evidence.json'),JSON.stringify({frames:240,fps:30,durationSeconds:8,geometry,repeatedFrame43Identical:true,pageErrors:errors},null,2));
  console.log(`Render complete: ${output}`);
} finally {await browser?.close(); await new Promise(r=>server.close(r));}
