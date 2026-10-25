import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,renderMedia,openBrowser} from '@remotion/renderer';
import {enableTailwind} from '@remotion/tailwind-v4';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withVerifiedHostEvidence} from '../../tools/host-evidence.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'out/host-evidence-visuals');
await mkdir(out,{recursive:true});
const source=JSON.parse(await readFile(resolve(root,process.env.PROPS_PATH || '.workbench/props-20261025030820.json'),'utf8'));
const props=await withVerifiedHostEvidence(source,root);
await writeFile(resolve(out,'props.json'),JSON.stringify(props,null,2));
const serveUrl=await bundle({entryPoint:resolve(root,'src/index.ts'),outDir:resolve(out,'bundle'),bundlerOverride:enableTailwind});
const browser=await openBrowser('chrome',{browserExecutable:process.env.CHROME_PATH || '/Users/ljk/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',chromeMode:'chrome-for-testing'});
try{
  const composition=await selectComposition({serveUrl,id:'HostExplainer',inputProps:props,puppeteerInstance:browser});
  const shared={serveUrl,composition,inputProps:props,puppeteerInstance:browser};
  const examples=[['source-overview',8.25],['source-focus',10.5],['mrr-chart',26.4],['strategy-establish',28.4],['strategy-focus',33.5]];
  for(const [name,time] of examples){await renderStill({...shared,frame:Math.round(time*30),scale:0.5,imageFormat:'png',output:resolve(out,`${name}.png`)});}
  const missingProps={cases:[{title:'图片回退验证'}],beats:[{say:'图片无法载入时保留可读说明',headline:'图片回退验证',accent:'图片',section:'case',caseIndex:0,host:'point',scene:'product',startMs:0,endMs:4000,elements:[{type:'image',src:'case-images/missing-focus-check.png',caption:'原图暂不可用',focus:{x:0.2,y:0.2,width:0.4,height:0.4,label:'回退验证'}}]}]};
  const missingComposition=await selectComposition({serveUrl,id:'HostExplainer',inputProps:missingProps,puppeteerInstance:browser});
  await renderStill({serveUrl,composition:missingComposition,inputProps:missingProps,puppeteerInstance:browser,frame:75,scale:0.5,imageFormat:'png',output:resolve(out,'missing-focus.png')});
  if(!process.env.STILLS_ONLY){
    let last=-1;
    await renderMedia({...shared,codec:'h264',scale:0.5,concurrency:2,muted:true,crf:20,outputLocation:resolve(out,'preview.mp4'),onProgress:({progress})=>{const step=Math.floor(progress*4);if(step!==last){last=step;console.log(`Evidence scenes: ${Math.round(progress*100)}%`);}}});
  }
  await writeFile(resolve(out,'evidence.json'),JSON.stringify({profiles:props.hostEvidence?.map(p=>({image:p.image,sha256:p.sha256})),examples,frames:composition.durationInFrames,fps:composition.fps,scale:0.5},null,2));
  console.log(`Evidence visuals: ${out}`);
}finally{await browser.close({silent:true});}
