import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia, renderStill, openBrowser} from '@remotion/renderer';
import {enableTailwind} from '@remotion/tailwind-v4';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out=resolve(root,'out/svg-host-integration');
await mkdir(out,{recursive:true});
const serveUrl=await bundle({entryPoint:resolve(root,'src/index.ts'),outDir:resolve(out,'bundle'),bundlerOverride:enableTailwind});
const browserExecutable=process.env.CHROME_PATH || '/Users/ljk/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await openBrowser('chrome',{browserExecutable,chromeMode:'chrome-for-testing'});
const evidence=[];
try {
  for(const id of ['HostExplainer','HostExplainerDemo']) {
    const composition=await selectComposition({serveUrl,id,puppeteerInstance:browser});
    const shared={serveUrl,composition,puppeteerInstance:browser,inputProps:{}};
    for(const frame of id==='HostExplainer'?[0,30,49,70,120,150]:[49,200,350]) {
      await renderStill({...shared,frame,output:resolve(out,`${id}-${frame}.png`),imageFormat:'png',scale:0.5});
    }
    let last=-1;
    await renderMedia({...shared,codec:'h264',outputLocation:resolve(out,`${id}.mp4`),scale:0.5,concurrency:2,crf:20,muted:true,onProgress:({progress})=>{const step=Math.floor(progress*4);if(step!==last){last=step;console.log(`${id}: ${Math.round(progress*100)}%`);}}});
    const gif=spawnSync('ffmpeg',['-y','-i',resolve(out,`${id}.mp4`),'-vf','fps=10,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',resolve(out,`${id}.gif`)],{encoding:'utf8'});
    if(gif.status!==0)throw Error(gif.stderr);
    evidence.push({id,sourceWidth:composition.width,sourceHeight:composition.height,fps:composition.fps,frames:composition.durationInFrames,previewScale:0.5,audio:false});
  }
  await writeFile(resolve(out,'render-evidence.json'),JSON.stringify(evidence,null,2));
  console.log(`Integrated previews: ${out}`);
} finally {await browser.close({silent:true});}
