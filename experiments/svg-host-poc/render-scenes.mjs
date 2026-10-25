import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,renderMedia,openBrowser} from '@remotion/renderer';
import {enableTailwind} from '@remotion/tailwind-v4';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {enrichBeatScenes} from '../../tools/beat-spec.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'out/host-visual-scenes');
await mkdir(out,{recursive:true});
const source=JSON.parse(await readFile(resolve(root,process.env.PROPS_PATH || '.workbench/props-20261024155538.json'),'utf8'));
const props={...source,beats:enrichBeatScenes(source.beats,source)};
await writeFile(resolve(out,'props.json'),JSON.stringify(props,null,2));
const serveUrl=await bundle({entryPoint:resolve(root,'src/index.ts'),outDir:resolve(out,'bundle'),bundlerOverride:enableTailwind});
const browser=await openBrowser('chrome',{browserExecutable:process.env.CHROME_PATH || '/Users/ljk/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',chromeMode:'chrome-for-testing'});
try{
  const composition=await selectComposition({serveUrl,id:'HostExplainer',inputProps:props,puppeteerInstance:browser});
  const shared={serveUrl,composition,inputProps:props,puppeteerInstance:browser};
  const examples=[];
  for(const type of ['product','metric','steps','statement']){
    const index=props.beats.findIndex(b=>b.scene===type);
    if(index<0)continue;
    const beat=props.beats[index];
    const frame=Math.round((beat.startMs/1000)*30)+60;
    await renderStill({...shared,frame,scale:0.5,imageFormat:'png',output:resolve(out,`${type}.png`)});
    examples.push({type,index,frame});
  }
  // Isolate renderer behavior for a supported sequence and a missing source.
  const checks=[
    {name:'steps-check',beat:{say:'先打开产品页，再选择关键词，最后查看结果',headline:'从选择到结果',accent:'结果',section:'case',caseIndex:0,host:'point',scene:'steps',startMs:0,endMs:5000,elements:[{type:'card',title:'操作步骤',lines:['打开产品页','选择关键词','查看结果']}] }},
    {name:'missing-image-check',beat:{say:'原图暂时无法载入',headline:'图片加载回退验证',accent:'图片',section:'case',caseIndex:0,host:'point',scene:'product',startMs:0,endMs:5000,elements:[{type:'image',src:'case-images/missing-qa-image.png',caption:'缺失图片测试'}] }},
  ];
  for(const check of checks){
    const inputProps={cases:[{title:'布局验证'}],beats:[check.beat]};
    const config=await selectComposition({serveUrl,id:'HostExplainer',inputProps,puppeteerInstance:browser});
    await renderStill({serveUrl,composition:config,inputProps,puppeteerInstance:browser,frame:90,scale:0.5,imageFormat:'png',output:resolve(out,`${check.name}.png`)});
  }
  if(!process.env.CHECKS_ONLY){
    let last=-1;
    await renderMedia({...shared,codec:'h264',scale:0.5,concurrency:2,muted:true,crf:20,outputLocation:resolve(out,'preview.mp4'),onProgress:({progress})=>{const step=Math.floor(progress*4);if(step!==last){last=step;console.log(`Scenes: ${Math.round(progress*100)}%`);}}});
  }
  const imageCases=props.cases.map((c,index)=>({index,title:c.title,image:c.image,shown:props.beats.some(b=>b.caseIndex===index&&b.elements.some(e=>e.type==='image'&&e.src===c.image))}));
  await writeFile(resolve(out,'evidence.json'),JSON.stringify({examples,imageCases,frames:composition.durationInFrames,fps:composition.fps,scale:0.5,checks:checks.map(c=>c.name)},null,2));
  console.log(`Scene outputs: ${out}`);
}finally{await browser.close({silent:true});}
