import headerMark from './assets/header-mark.png';

import React,{useEffect,useMemo,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import './style.css';
const palette=['#2563eb','#e11d48','#d97706','#16a34a','#9333ea','#0891b2','#ea580c','#be185d','#4f46e5','#65a30d','#dc2626','#0d9488','#7c3aed','#ca8a04','#0284c7','#b45309','#f43f5e','#f97316','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#6366f1','#8b5cf6','#d946ef','#ec4899','#fb7185','#a16207','#475569','#2dd4bf'];
const uid=()=>Math.random().toString(36).slice(2,10);
const defaults={courts:4,format:'integral',mode:'points',points:15,winByTwo:true,cap:21,minutes:10};
const settingsOf=s=>({...defaults,...(s.settings||{})});
const init=()=>({settings:{...defaults},title:'Tournoi de badminton',teams:[],pools:2,phase:'setup',matches:[],courtIds:[null,null,null,null],finalRounds:[],finalSize:0});
function load(){try{return JSON.parse(localStorage.getItem('badminton-v1'))||init()}catch{return init()}}
const isPower=n=>n>0&&(n&(n-1))===0;
function valid(a,b,settings=defaults){
 a=Number(a);b=Number(b);if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return false;
 const rules={...defaults,...settings},hi=Math.max(a,b),lo=Math.min(a,b);
 if(rules.mode==='time')return true;
 const target=Number(rules.points)||15;
 if(!rules.winByTwo)return hi===target&&lo<target;
 const cap=Math.max(target,Number(rules.cap)||target);
 return (hi>=target&&hi-lo>=2&&hi<cap)||(hi===cap&&lo<cap);
}
function ranks(teams,matches){let rows=teams.map(t=>({...t,played:0,w:0,l:0,pf:0,pa:0}));for(let m of matches.filter(m=>m.status==='done')){let a=rows.find(x=>x.id===m.a),b=rows.find(x=>x.id===m.b);if(!a||!b)continue;a.played++;b.played++;a.pf+=+m.sa;a.pa+=+m.sb;b.pf+=+m.sb;b.pa+=+m.sa;if(+m.sa>+m.sb){a.w++;b.l++}else{b.w++;a.l++}}return rows.sort((a,b)=>b.w-a.w||(b.pf-b.pa)-(a.pf-a.pa)||b.pf-a.pf||a.name.localeCompare(b.name))}
function makePools(teams,count){let ids=[...teams].sort(()=>Math.random()-.5);let buckets=Array.from({length:count},()=>[]);ids.forEach((t,i)=>buckets[i%count].push(t));let matches=[];buckets.forEach((arr,p)=>{for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++)matches.push({id:uid(),a:arr[i].id,b:arr[j].id,pool:p,phase:'pool',status:'waiting',sa:'',sb:'',court:null})});return{buckets,matches}}
function seedOrder(n){if(n===2)return[1,2];let old=seedOrder(n/2),out=[];old.forEach(x=>out.push(x,n+1-x));return out}
// Classification bracket: every match splits an interval into upper and lower halves.
// Every team plays log2(N) classification matches when N is a power of two.
function makeFinal(ordered){let n=ordered.length;if(!isPower(n))throw Error('Le tableau final nécessite ici 2, 4, 8, 16 ou 32 équipes.');let order=seedOrder(n);let seeds=order.map(s=>ordered[s-1].id);let rounds=[];let first=[];for(let i=0;i<n;i+=2)first.push({id:uid(),a:seeds[i],b:seeds[i+1],phase:'final',round:0,group:Math.floor(i/2),status:'waiting',sa:'',sb:'',court:null,range:[1,n]});rounds.push(first.map(x=>x.id));let matches=[...first];for(let r=1;r<Math.log2(n);r++){let prev=matches.filter(x=>x.round===r-1);let next=[];for(let i=0;i<prev.length;i+=2){for(let outcome of ['winner','loser']){let a=prev[i],b=prev[i+1];let m={id:uid(),a:null,b:null,phase:'final',round:r,group:next.length,status:'blocked',sa:'',sb:'',court:null,sourceA:{id:a.id,outcome},sourceB:{id:b.id,outcome}};next.push(m)}}matches.push(...next);rounds.push(next.map(x=>x.id))}return{matches,rounds}}
// For a complete classification bracket, losers of every match move to their own classification track.
// Build rounds as groups of pairs of equal result histories, e.g. WW/WL/LW/LL.
function buildClassification(ids){let n=ids.length,levels=Math.log2(n),matches=[],rounds=[];let first=[];let seed=seedOrder(n);for(let i=0;i<n;i+=2)first.push({id:uid(),a:ids[seed[i]-1],b:ids[seed[i+1]-1],phase:'final',round:0,path:'',status:'waiting',sa:'',sb:'',court:null});matches.push(...first);rounds.push(first.map(m=>m.id));for(let r=1;r<levels;r++){let next=[];let previous=matches.filter(m=>m.round===r-1);let paths=[...new Set(previous.map(m=>m.path))];for(let path of paths){let group=previous.filter(m=>m.path===path);for(let outcome of ['W','L']){for(let i=0;i<group.length;i+=2){let a=group[i],b=group[i+1];next.push({id:uid(),a:null,b:null,phase:'final',round:r,path:path+outcome,status:'blocked',sa:'',sb:'',court:null,sourceA:{id:a.id,outcome},sourceB:{id:b.id,outcome}})}}}matches.push(...next);rounds.push(next.map(m=>m.id))}return{matches,rounds}}
// Alternative robust classification construction: at each stage, group teams by win/loss history.
// The first round pairs seeds 1 vs N, 2 vs N-1 etc; subsequent rounds pair winners
// with winners and losers with losers from adjacent feeder matches.
function classification(ids){let n=ids.length,k=Math.log2(n),all=[],rounds=[];let seed=seedOrder(n),prev=[];for(let i=0;i<n;i+=2){prev.push({id:uid(),a:ids[seed[i]-1],b:ids[seed[i+1]-1],round:0,path:'',status:'waiting',sa:'',sb:'',court:null,phase:'final'})}all.push(...prev);rounds.push(prev.map(m=>m.id));for(let r=1;r<k;r++){let next=[];let paths=[...new Set(prev.map(x=>x.path))];for(let path of paths){let candidates=prev.filter(x=>x.path===path);for(let outcome of ['W','L']){for(let i=0;i<candidates.length;i+=2){let a=candidates[i],b=candidates[i+1];next.push({id:uid(),a:null,b:null,round:r,path:path+outcome,status:'blocked',sa:'',sb:'',court:null,phase:'final',sourceA:{id:a.id,outcome},sourceB:{id:b.id,outcome}})}}}if(next.length!==n/2)throw Error('Erreur de tableau');all.push(...next);rounds.push(next.map(x=>x.id));prev=next}return{matches:all,rounds}}
// Classification construction uses the same number of matches in every round, with paths
// assigned by a binary tree of classification groups.
function createClassification(ids){let n=ids.length,k=Math.log2(n),rounds=[],all=[];let seeds=seedOrder(n),prev=[];for(let i=0;i<n;i+=2)prev.push({id:uid(),a:ids[seeds[i]-1],b:ids[seeds[i+1]-1],round:0,path:'',status:'waiting',sa:'',sb:'',court:null,phase:'final'});all.push(...prev);rounds.push(prev.map(x=>x.id));for(let r=1;r<k;r++){let next=[];let groups=new Map();for(let m of prev){for(let outcome of ['W','L']){let path=m.path+outcome;if(!groups.has(path))groups.set(path,[]);groups.get(path).push({id:m.id,outcome})}}for(let [path,sources]of groups){for(let i=0;i<sources.length;i+=2){next.push({id:uid(),a:null,b:null,round:r,path,status:'blocked',sa:'',sb:'',court:null,phase:'final',sourceA:sources[i],sourceB:sources[i+1]})}}all.push(...next);rounds.push(next.map(x=>x.id));prev=next}return{matches:all,rounds}}
// Classement intégral pour tout effectif : chaque groupe se sépare en gagnants et perdants.
// Les groupes impairs accordent une exemption au mieux classé du groupe.
function createGroup(state,ids,start,round,key){if(ids.length===0)return state;if(ids.length===1){state.finalPositions[start]=ids[0];return state}const group={id:key,ids:[...ids],start,round,matchIds:[],byeIds:[],processed:false};let pairings=[];const participants=[...ids];if(participants.length%2)group.byeIds.push(participants.shift());const size=participants.length;for(let i=0;i<size/2;i++)pairings.push(round===0&&key==='F'?[participants[i],participants[size-1-i]]:[participants[2*i],participants[2*i+1]]);for(let [a,b] of pairings){let m={id:uid(),a,b,phase:'final',round,groupKey:key,status:'waiting',sa:'',sb:'',court:null};state.matches.push(m);group.matchIds.push(m.id)}state.finalGroups.push(group);if(!state.finalRounds[round])state.finalRounds[round]=[];state.finalRounds[round].push(...group.matchIds);return state}
function advanceGroups(state){let changed=true;while(changed){changed=false;for(const group of state.finalGroups){if(group.processed||!group.matchIds.every(id=>state.matches.find(m=>m.id===id)?.status==='done'))continue;group.processed=true;changed=true;const winners=[...group.byeIds],losers=[];for(const id of group.matchIds){const m=state.matches.find(x=>x.id===id);if(+m.sa>+m.sb){winners.push(m.a);losers.push(m.b)}else{winners.push(m.b);losers.push(m.a)}}// Conserver l’ordre des matchs précédents pour éviter les croisements.
createGroup(state,winners,group.start,group.round+1,group.id+'W');createGroup(state,losers,group.start+winners.length,group.round+1,group.id+'L')}}return state}

// Plan complet des rencontres, affiché avant que leurs participants soient connus.
// Numérotation déterministe : préliminaires, puis tours successifs, de haut en bas.
function plannedBracket(state, teamsById){
 if(state.phase!=='final')return [];
 const actual=new Map((state.finalGroups||[]).map(g=>[g.id,g]));
 const prelim=(state.prelimIds||[]).map(id=>state.matches.find(m=>m.id===id)).filter(Boolean);
 let number=1;
 const stages=[];
 const prelimNumbers=prelim.map(()=>number++);
 if(prelim.length)stages.push({title:'Tour préliminaire',matches:prelim.map((m,i)=>({number:prelimNumbers[i],actual:m,slots:[m.a,m.b].map(id=>({id,label:teamsById[id]?.name||'À déterminer'})),track:'Préliminaires'}))});
 const first=[];
 if(prelim.length){
   const power=2**Math.floor(Math.log2(state.finalSize));
   first.push({key:'F',start:1,slots:[...(state.prelimDirect||[]).map(id=>({id,label:teamsById[id]?.name||'À déterminer'})),...prelimNumbers.map(n=>({label:`Vainqueur du match ${n}`}))]});
   first.push({key:'P',start:power+1,slots:prelimNumbers.map(n=>({label:`Perdant du match ${n}`}))});
 }else{
   const g=actual.get('F');if(g)first.push({key:'F',start:1,slots:g.ids.map(id=>({id,label:teamsById[id]?.name||'À déterminer'}))});
 }
 let pending=first,round=0;
 while(pending.length&&round<12){
   const stage={title:`Tour ${round+1}`,matches:[]},following=[];
   for(const g of pending){
     const existing=actual.get(g.key);
     const slots=[...g.slots];
     const direct=slots.length%2?slots.shift():null;
     const winners=direct?[direct]:[],losers=[];
     const pairCount=slots.length/2;
     for(let i=0;i<pairCount;i++){
       const a=round===0&&g.key==='F'?slots[i]:slots[2*i],b=round===0&&g.key==='F'?slots[slots.length-1-i]:slots[2*i+1];
       const n=number++;
       const m=existing?.matchIds?.[i]?state.matches.find(x=>x.id===existing.matchIds[i]):null;
       stage.matches.push({number:n,actual:m,slots:[a,b],path:g.key,track:g.key==='F'?'Tableau principal':g.key==='P'?'Classement préliminaires':`Places ${g.start} à ${g.start+g.slots.length-1}`});
       winners.push({label:`Vainqueur du match ${n}`});losers.push({label:`Perdant du match ${n}`});
     }
     if(winners.length>1)following.push({key:g.key+'W',start:g.start,slots:winners});
     if(losers.length>1)following.push({key:g.key+'L',start:g.start+winners.length,slots:losers});
   }
   if(stage.matches.length)stages.push(stage);
   pending=following;round++;
 }
 return stages;
}


// Sections indépendantes : les traits suivent les positions réelles des rencontres.
function BracketSection({title,stages,teams}){
 const board=useRef(null),[links,setLinks]=useState([]);
 useEffect(()=>{
  const root=board.current;if(!root)return;
  const draw=()=>{
   const rect=root.getBoundingClientRect(),nodes=[...root.querySelectorAll('[data-match-number]')];
   const positions=new Map(nodes.map(node=>{const r=node.getBoundingClientRect();return [Number(node.dataset.matchNumber),{x:r.left-rect.left,y:r.top-rect.top,w:r.width,h:r.height}]}));
   const result=[];
   for(const node of nodes){const target=positions.get(Number(node.dataset.matchNumber));
    for(const [index,slot] of [...node.querySelectorAll('[data-source-match]')].entries()){
     const n=Number(slot.dataset.sourceMatch),source=positions.get(n);if(!source||!target||source.x>=target.x)continue;
     const sy=source.y+source.h/2,ty=target.y+(index===0?target.h*.43:target.h*.76),sx=source.x+source.w,tx=target.x;
     const mid=sx+(tx-sx)/2;
     result.push(`M ${sx} ${sy} H ${mid} V ${ty} H ${tx}`);
    }
   }
   setLinks(result);
  };
  draw();const observer=new ResizeObserver(draw);observer.observe(root);window.addEventListener('resize',draw);
  return()=>{observer.disconnect();window.removeEventListener('resize',draw)};
 },[stages]);
 return <div className="bracketSeparate"><div className="bracketSeparateTitle"><h4>{title}</h4><span>Glisser horizontalement pour voir les tours suivants →</span></div><div className="bracketScroll" tabIndex="0" role="region" aria-label={title}><div className="bracketBoard" ref={board}><svg className="bracketWires" aria-hidden="true">{links.map((d,i)=><path key={i} d={d}/>)}</svg><div className="bracketColumns">{stages.map((stage,i)=><div className="bracketColumn" key={i}><div className="bracketColumnTitle">{stage.title}</div><div className="bracketColumnMatches">{stage.matches.map(entry=>{const m=entry.actual,winner=m?.status==='done'?(+m.sa>+m.sb?m.a:m.b):null;return <div className="bracketMatch" data-match-number={entry.number} key={entry.number}><div className="bracketMatchLabel"><strong>Match {entry.number}</strong> · {m?.status==='playing'?`Terrain ${m.court+1}`:m?.status==='done'?'Terminé':m?'À jouer':'À venir'}</div>{entry.slots.map((slot,j)=>{const id=m?.[j===0?'a':'b']||slot.id;const label=teams[id]?.name||slot.label||'À déterminer';const source=label.match(/(?:Vainqueur|Perdant) du match (\d+)/i);return <div className={'bracketPlayer '+(winner&&winner===id?'bracketWinner':'')} key={j} data-source-match={source?source[1]:undefined}><i style={{background:teams[id]?.color||'#9bb5ca'}}/><span>{label}</span><b>{m?.status==='done'?(j===0?m.sa:m.sb):'–'}</b></div>})}</div>})}</div></div>)}</div></div></div></div>;
}
// Tableau principal type Challonge : placement calculé à partir des vainqueurs uniquement.
function UnifiedBracket({stages,teams,classificationPaths}){
 const viewport=useRef(null),[zoom,setZoom]=useState(.7);
 const W=194,GAP=24,STEP=94,TOP=82,SECTION_GAP=12,CARD_H=88;
 const roots=[{path:'F',label:'🏆 Tableau principal',start:1},...classificationPaths].sort((a,b)=>a.start-b.start);
 const sections=[];let offset=0;
 const prelimStage=stages.findIndex(s=>s.title==='Tour préliminaire');
 const mainStages=stages.map((s,i)=>i).filter(i=>i!==prelimStage);
 const titleForStage=(stageIndex)=>{
  if(stageIndex===prelimStage)return 'Tour préliminaire';
  const remaining=mainStages.filter(i=>i>=stageIndex).length;
  return ({1:'Finale',2:'Demi-finales',3:'Quarts de finale',4:'Huitièmes de finale',5:'Seizièmes de finale',6:'32es de finale'})[remaining]||`Tour ${stageIndex+1}`;
 };
 for(const root of roots){
  const columns=stages.map((stage,stageIndex)=>({stageIndex,entries:stage.matches.filter(m=>{
   const path=m.path||'';
   return (root.path==='F'&&stage.title==='Tour préliminaire'&&m.track==='Préliminaires')||path===root.path||(path.startsWith(root.path)&&/^W+$/.test(path.slice(root.path.length)));
  })})).filter(c=>c.entries.length);
  if(!columns.length)continue;
  const positions=new Map();
  columns.forEach(({stageIndex,entries})=>entries.forEach((entry,i)=>{
   const sources=entry.slots.map(slot=>String(slot.label||'').match(/^Vainqueur du match (\d+)$/i)).filter(Boolean).map(m=>positions.get(Number(m[1]))).filter(Boolean);
   const ideal=sources.length===2?(sources[0].y+sources[1].y)/2:sources.length===1?sources[0].y:TOP+i*STEP;
   const previous=[...positions.values()].filter(n=>n.stageIndex===stageIndex).at(-1);
   const y=previous?Math.max(ideal,previous.y+STEP):Math.max(TOP,ideal);
   positions.set(entry.number,{x:stageIndex*(W+GAP),y,entry,stageIndex});
  }));
  const nodes=[...positions.values()];
  const minY=Math.min(...nodes.map(n=>n.y));
  const sectionTop=root.path==='F'?82:48;
  // Chaque finale de classement se termine dans la même colonne que la grande finale.
  const lastStage=Math.max(...nodes.map(n=>n.stageIndex));
  const lastGlobalStage=stages.length-1;
  const shift=(root.path==='F'?0:lastGlobalStage-lastStage)*(W+GAP);
  for(const n of nodes){n.y=n.y-minY+sectionTop;n.x+=shift;}
  const sectionHeight=Math.max(sectionTop+CARD_H+8,...nodes.map(n=>n.y+CARD_H+8));
  const finalNodes=nodes.filter(n=>n.stageIndex===lastStage);
  const label=root.path==='F'?'🏆 Tableau principal':`🏸 Match places ${root.start}–${Math.min(root.start+1,root.finish||root.start+1)}`;
  sections.push({root,label,columns,nodes,positions,offset,height:sectionHeight,finalNodes,shift});
  offset+=sectionHeight+SECTION_GAP;
 }
 const width=Math.max(540,stages.length*(W+GAP)-GAP+16),height=Math.max(260,offset-SECTION_GAP+10);
 const lines=[];
 for(const section of sections)for(const node of section.nodes)for(const slot of node.entry.slots){
  const m=String(slot.label||'').match(/^Vainqueur du match (\d+)$/i);if(!m)continue;
  const source=section.positions.get(Number(m[1]));if(!source||source.x>=node.x)continue;
  const x1=source.x+W,y1=section.offset+source.y+CARD_H/2,x2=node.x,y2=section.offset+node.y+CARD_H/2,mid=(x1+x2)/2;
  lines.push(`M${x1},${y1} H${mid} V${y2} H${x2}`);
 }
 const fit=()=>{const available=viewport.current?.clientWidth||900;setZoom(Math.max(.15,Math.min(1,(available-30)/width)))};
 return <div className="challongeWrap"><div className="challongeTools"><strong>🏆 Tableau complet · classement intégral</strong><div><button onClick={()=>setZoom(z=>Math.max(.15,+(z-.1).toFixed(2)))}>−</button><span>{Math.round(zoom*100)} %</span><button onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(2)))}>+</button><button onClick={()=>setZoom(1)}>100 %</button><button onClick={fit}>Vue complète</button></div></div><div className="challongeViewport unifiedViewport" ref={viewport} tabIndex="0" role="region" aria-label="Tableau complet, déplaçable horizontalement et verticalement"><div style={{width:width*zoom,height:height*zoom,position:'relative'}}><div className="challongeCanvas" style={{width,height,transform:`scale(${zoom})`,transformOrigin:'top left'}}><svg className="challongeLines" width={width} height={height} aria-hidden="true">{lines.map((d,i)=><path d={d} key={i}/>)}</svg>{sections.map(section=><React.Fragment key={section.root.path}>{section.root.path==='F'&&<div className="unifiedSectionHeading" style={{top:section.offset,left:0,width}}>{section.label}</div>}{section.columns.map(({stageIndex})=><div key={stageIndex} className="challongeRoundTitle" style={{top:section.offset+(section.root.path==='F'?39:8),left:stageIndex*(W+GAP)+section.shift,width:W}}>{section.root.path==='F'?titleForStage(stageIndex):stageIndex===section.columns.at(-1).stageIndex?section.label.replace(/^🏸 /,''):`Classement · ${titleForStage(stageIndex)}`}</div>)}{section.nodes.map(({x,y,entry})=>{const m=entry.actual,winner=m?.status==='done'?(+m.sa>+m.sb?m.a:m.b):null;return <div key={entry.number} className="challongeMatch" style={{left:x,top:section.offset+y,width:W}}><div className="challongeMatchHead">Match {entry.number}<span>{m?.status==='playing'?`Terrain ${m.court+1}`:m?.status==='done'?'Terminé':m?'À jouer':'À venir'}</span></div>{entry.slots.map((slot,j)=>{const id=m?.[j?'b':'a']||slot.id;return <div key={j} className={'challongeParticipant '+(winner===id&&winner?'challongeWinner':'')}><i style={{background:teams[id]?.color||'#a5b9ca'}}/><span>{teams[id]?.name||slot.label||'À déterminer'}</span><b>{m?.status==='done'?(j?m.sb:m.sa):'–'}</b></div>})}</div>})}</React.Fragment>)}</div></div></div><p className="bracketHint">Un seul tableau · tour préliminaire compris · classements rangés par places · zoom et déplacement libres.</p></div>;
}

// Tableau préconstruit : chaque rencontre possède deux sources explicites.
// Les perdants des tours principaux entrent dans le tableau de rattrapage.
function doubleMatch(a,b,track,round){return {id:uid(),a,b,phase:'final',track,round,status:'waiting',sa:'',sb:'',court:null}}
function newDoubleNode(state,track,round,sourceA,sourceB,extra={}){
 const m={...doubleMatch(null,null,track,round),number:state.matches.length+1,sourceA,sourceB,...extra,status:'blocked'};
 state.matches.push(m);return m;
}
const direct=id=>({team:id});
const from=(m,outcome)=>({id:m.id,outcome});
// A partir des poules, on conserve l'ordre des têtes de série, mais on
// permute uniquement des positions de force voisine pour limiter les rematches.
function avoidPoolRematches(ids,assignments){
 if(!assignments)return ids;
 const result=[...ids],n=result.length,size=2**Math.ceil(Math.log2(n));
 const slots=seedOrder(n===18?16:size);
 const conflict=(order)=>{
  const first=n===18?order.slice(0,14).concat([order[14],order[15]]):order;
  let bad=0;
  for(let i=0;i<slots.length;i+=2){const a=first[slots[i]-1],b=first[slots[i+1]-1];if(a&&b&&assignments[a]===assignments[b])bad++}
  if(n===18){if(assignments[order[14]]===assignments[order[17]])bad++;if(assignments[order[15]]===assignments[order[16]])bad++;}
  return bad;
 };
 let best=conflict(result);
 // Déplacements locaux seulement : on conserve la hiérarchie générale des poules.
 for(let pass=0;pass<4;pass++){
  let improved=false;
  for(let i=0;i<n;i++)for(let j=i+1;j<Math.min(n,i+5);j++){
   [result[i],result[j]]=[result[j],result[i]];
   const score=conflict(result);
   if(score<best){best=score;improved=true}else [result[i],result[j]]=[result[j],result[i]];
  }
  if(!improved)break;
 }
 return result;
}
function doubleStart(state,ids){
 if(ids.length<2)throw Error('Il faut au moins deux équipes.');
 state.double={planned:true,champion:null,runner:null,entrants:[...ids],seedRank:Object.fromEntries(ids.map((id,i)=>[id,i]))};
 const wb=[],lb=[];
 const use18=ids.length===18;
 if(use18){
  // Deux barrages d'entrée au tableau principal à 16 équipes.
  const pre=[newDoubleNode(state,'upper',-1,direct(ids[14]),direct(ids[17])),newDoubleNode(state,'upper',-1,direct(ids[15]),direct(ids[16]))];
  const mainEntrants=ids.slice(0,14).map(direct).concat(pre.map(m=>from(m,'winner')));
  let entrants=seedOrder(16).map(i=>mainEntrants[i-1]);
  for(let r=0;entrants.length>1;r++){
   const round=[];for(let i=0;i<entrants.length;i+=2)round.push(newDoubleNode(state,'upper',r,entrants[i],entrants[i+1]));
   wb.push(round);entrants=round.map(m=>from(m,'winner'));
  }
  // Les 2 moins bien classés parmi les 8 perdants du premier tour
  // affrontent les perdants des préliminaires. Le classement est résolu
  // seulement quand les huit matchs sont terminés.
  const barrages=[newDoubleNode(state,'lower',-1,from(pre[0],'loser'),{lowerSeedLoser:0}),newDoubleNode(state,'lower',-1,from(pre[1],'loser'),{lowerSeedLoser:1})];
  const arrivals=[...barrages.map(m=>from(m,'winner')),...Array.from({length:6},(_,i)=>({lowerSeedLoser:i+2}))];
  const first=[];for(let i=0;i<arrivals.length;i+=2)first.push(newDoubleNode(state,'lower',0,arrivals[i],arrivals[i+1]));
  lb.push([ ...barrages ],first);
 }else{
  const size=2**Math.ceil(Math.log2(ids.length));let entrants=seedOrder(size).map(i=>i<=ids.length?direct(ids[i-1]):{bye:true});
  for(let r=0;entrants.length>1;r++){
   const round=[];for(let i=0;i<entrants.length;i+=2)round.push(newDoubleNode(state,'upper',r,entrants[i],entrants[i+1]));
   wb.push(round);entrants=round.map(m=>from(m,'winner'));
  }
  if(ids.length>2){
   const arrivals=wb[0].map(m=>from(m,'loser')),first=[];
   for(let i=0;i<arrivals.length;i+=2)first.push(newDoubleNode(state,'lower',0,arrivals[i],arrivals[i+1]));
   lb.push(first);
  }
 }
 if(ids.length>2){
  let prev=lb.at(-1);
  for(let r=1;r<wb.length;r++){
   const inject=[];
   for(let i=0;i<prev.length;i++)inject.push(newDoubleNode(state,'lower',2*r-1,from(prev[i],'winner'),from(wb[r][r%2===1?wb[r].length-1-i:i],'loser')));
   lb.push(inject);prev=inject;
   if(r<wb.length-1){
    const compact=[];
    for(let i=0;i<prev.length;i+=2)compact.push(newDoubleNode(state,'lower',2*r,from(prev[i],'winner'),from(prev[i+1],'winner')));
    lb.push(compact);prev=compact;
   }
  }
 }
 const lastLower=lb.length?lb.at(-1)[0]:wb[0][0];
 const lowerSource=lb.length?from(lastLower,'winner'):from(lastLower,'loser');
 const gf=newDoubleNode(state,'grand',0,from(wb.at(-1)[0],'winner'),lowerSource);
 newDoubleNode(state,'grand',1,from(gf,'loser'),from(gf,'winner'),{conditionalReset:true});
 const nodeById=Object.fromEntries(state.matches.map(m=>[m.id,m]));
 const viable=src=>{
  if(!src||src.bye)return false;
  if(src.team||src.lowerSeedLoser!==undefined)return true;
  const m=nodeById[src.id];if(!m)return false;
  const a=viable(m.sourceA),b=viable(m.sourceB);
  return src.outcome==='winner'?(a||b):(a&&b);
 };
 const cohorts=lb.map(round=>round.map(m=>from(m,'loser')).filter(viable)).filter(group=>group.length);
 let nextPlace=3;
 const classify=(sources,place,depth)=>{
  if(sources.length===1){state.double.rankSources[place]=sources[0];return;}
  if(sources.length===2){newDoubleNode(state,'places',depth,sources[0],sources[1],{place});return;}
  const paired=[];
  for(let i=0;i<sources.length;i+=2)paired.push(newDoubleNode(state,'places',depth,sources[i],sources[i+1]));
  classify(paired.map(m=>from(m,'winner')),place,depth+1);
  classify(paired.map(m=>from(m,'loser')),place+paired.length,depth+1);
 };
 state.double.rankSources={};
 for(const group of cohorts.reverse()){
  classify(group,nextPlace,0);nextPlace+=group.length;
 }
 if(nextPlace!==ids.length+1)throw Error(`Classement incomplet : ${nextPlace-1} places pour ${ids.length} équipes`);
 doubleAdvance(state);return state;
}
function doubleAdvance(state){
 if(!state.double?.planned)return state;
 const byId=Object.fromEntries(state.matches.map(m=>[m.id,m]));
 const resolve=src=>{
  if(!src)return null;if(src.bye)return null;if(src.team)return src.team;
  if(src.lowerSeedLoser!==undefined){
   const first=state.matches.filter(x=>x.track==='upper'&&x.round===0);
   if(first.some(x=>!['done','bye'].includes(x.status)))return undefined;
   const losers=first.filter(x=>x.status==='done').map(x=>Number(x.sa)>Number(x.sb)?x.b:x.a);
   losers.sort((a,b)=>(state.double.seedRank[b]??-1)-(state.double.seedRank[a]??-1));
   return losers[src.lowerSeedLoser]??null;
  }
  const m=byId[src.id];if(!m||!['done','bye'].includes(m.status))return undefined;
  if(m.status==='bye')return src.outcome==='winner'?(m.a||m.b):null;
  const w=Number(m.sa)>Number(m.sb)?m.a:m.b;
  return src.outcome==='winner'?w:(w===m.a?m.b:m.a);
 };
 let changed=true;
 while(changed){changed=false;
  for(const m of state.matches.filter(m=>m.phase==='final'&&m.status==='blocked')){
   if(m.conditionalReset){
    const gf=state.matches.find(x=>x.track==='grand'&&x.round===0);
    if(gf?.status==='done'){
     const upper=resolve(gf.sourceA),winner=Number(gf.sa)>Number(gf.sb)?gf.a:gf.b;
     if(winner===upper){m.status='skipped';changed=true;continue;}
    }
   }
   const a=resolve(m.sourceA),b=resolve(m.sourceB);
   if(a!==undefined&&m.a!==a){m.a=a;changed=true;}if(b!==undefined&&m.b!==b){m.b=b;changed=true;}if(a!==undefined&&b!==undefined){m.status=a&&b?'waiting':'bye';changed=true;}
  }
 }
 // Le classement est actualisé automatiquement à mesure que les matches finissent.
 const gf=state.matches.find(m=>m.track==='grand'&&m.round===0);
 const reset=state.matches.find(m=>m.conditionalReset);
 const title=reset?.status==='done'?reset:reset?.status==='skipped'?gf:null;
 if(title?.status==='done'){
  const winner=Number(title.sa)>Number(title.sb)?title.a:title.b;
  state.finalPositions[1]=winner;state.finalPositions[2]=winner===title.a?title.b:title.a;
 }
 for(const m of state.matches.filter(m=>m.track==='places'&&m.place&&m.status==='done')){
  const winner=Number(m.sa)>Number(m.sb)?m.a:m.b;
  state.finalPositions[m.place]=winner;state.finalPositions[m.place+1]=winner===m.a?m.b:m.a;
 }
 // Places individuelles issues des tours où un seul joueur est éliminé.
 const rankSources=state.double.rankSources||{};
 for(const [place,source] of Object.entries(rankSources)){
  const id=resolve(source);
  if(id)state.finalPositions[Number(place)]=id;
 }
 return state;
}
function matchStageLabel(m,matches){
 if(!m)return '';
 if(m.phase==='pool')return `Poule ${String.fromCharCode(65+m.pool)}`;
 if(m.track==='places'){
  if(Number.isInteger(m.place))return `Classement · match pour les places ${m.place}–${m.place+1}`;
  // Une demi-finale de classement peut alimenter deux finales :
  // les gagnants jouent les meilleures places, les perdants les suivantes.
  const children=matches.filter(x=>x.track==='places'&&(x.sourceA?.id===m.id||x.sourceB?.id===m.id));
  const finalPlaces=new Set();
  const visit=(node,seen=new Set())=>{
   if(seen.has(node.id))return;
   seen.add(node.id);
   if(Number.isInteger(node.place)){finalPlaces.add(node.place);return;}
   matches.filter(x=>x.track==='places'&&(x.sourceA?.id===node.id||x.sourceB?.id===node.id)).forEach(x=>visit(x,seen));
  };
  children.forEach(x=>visit(x));
  const places=[...finalPlaces].sort((a,b)=>a-b);
  const suffix=places.length?` · places ${places[0]} à ${places[places.length-1]+1}`:'';
  const depth=Math.max(0,...children.map(x=>x.round-m.round));
  return `${depth===1?'Demi-finale':'Tour'} de classement${suffix}`;
 }
 if(m.conditionalReset)return 'Finale décisive · double élimination';
 if(m.track==='grand')return 'Grande finale · double élimination';
 const branch=m.track==='upper'?'tableau principal':m.track==='lower'?'tableau de rattrapage':'tableau final';
 const same=matches.filter(x=>x.phase==='final'&&x.track===m.track&&x.round>=0);
 const rounds=[...new Set(same.map(x=>x.round))].sort((a,b)=>a-b);
 const remaining=rounds.length-rounds.indexOf(m.round)-1;
 if(m.round<0)return `Tour préliminaire · ${branch}`;
 if(remaining===0)return `Finale · ${branch}`;
 if(remaining===1)return `Demi-finale · ${branch}`;
 if(remaining===2)return `Quart de finale · ${branch}`;
 return `Tour ${m.round+1} · ${branch}`;
}
function DoubleBracket({matches,teams}){
 const viewport=useRef(null),[zoom,setZoom]=useState(.7);
 const W=212,H=79,G=48,STEP=W+G,ROW=96,HEADER=64,SECTION_GAP=52;
 const upper=matches.filter(m=>m.track==='upper'),lower=matches.filter(m=>m.track==='lower');
 const grand=matches.filter(m=>m.track==='grand'),places=matches.filter(m=>m.track==='places');
 const roundsOf=ms=>[...new Set(ms.map(m=>m.round))].sort((a,b)=>a-b);
 const upperRounds=roundsOf(upper),lowerRounds=roundsOf(lower),placeRounds=roundsOf(places);
 const lastCore=Math.max(upperRounds.length,lowerRounds.length)-1;
 const grandCol=lastCore+1,resetCol=grandCol+1;
 const positions=new Map(),blocks=[];
 // Each track is a real elimination tree: a match is centered between its two
 // incoming winning matches. Sources from the other track are not drawn as
 // a fictitious winning-tree branch.
 function addTrack(ms,key,title,startY){
  const pitch=key==='upper'?83:ROW;
  if(!ms.length)return startY;
  const rounds=roundsOf(ms),byRound=rounds.map(r=>ms.filter(m=>m.round===r));
  const coords=new Map();
  byRound[0].forEach((m,i)=>coords.set(m.id,i*pitch));
  for(let c=1;c<byRound.length;c++){
   let prevBottom=-pitch;
   byRound[c].forEach((m,i)=>{
    const incoming=[m.sourceA,m.sourceB].filter(s=>s?.id&&s.outcome==='winner'&&coords.has(s.id));
    const desired=incoming.length?incoming.reduce((sum,s)=>sum+coords.get(s.id),0)/incoming.length:i*pitch*Math.max(1,2**c);
    const y=Math.max(desired,prevBottom+pitch);coords.set(m.id,y);prevBottom=y;
   });
  }
  // Retrouver l'arbre compact : déplacer les paires sans inverser leur ordre.
  for(let c=byRound.length-2;c>=0;c--){
   for(const target of byRound[c+1]){
    const currentIds=new Set(byRound[c].map(m=>m.id));
    const sources=[target.sourceA,target.sourceB].filter(src=>src?.id&&src.outcome==='winner'&&currentIds.has(src.id));
    if(sources.length===2){
     const [a,b]=sources.map(src=>src.id),middle=coords.get(target.id);
     const shift=middle-(coords.get(a)+coords.get(b))/2;
     coords.set(a,coords.get(a)+shift);coords.set(b,coords.get(b)+shift);
    }else if(sources.length===1){
     coords.set(sources[0].id,coords.get(target.id));
    }
   }
  }
  // Normalize the full track and keep all cards separated in every column.
  const min=Math.min(...coords.values());for(const [id,y] of coords)coords.set(id,y-min);
  for(const group of byRound){let last=-pitch;for(const m of group){const y=Math.max(coords.get(m.id),last+pitch);coords.set(m.id,y);last=y;}}
  if(key==='upper'){
   const prelim=ms.filter(m=>m.round<0);
   for(const m of prelim){
    const target=ms.find(t=>t.round===0&&[t.sourceA,t.sourceB].some(src=>src?.id===m.id&&src.outcome==='winner'));
    if(target&&coords.has(target.id))coords.set(m.id,coords.get(target.id));
   }
  }
  const bottom=Math.max(...[...coords.values()].map(y=>y+H));
  for(let c=0;c<byRound.length;c++)for(const m of byRound[c])positions.set(m.id,{m,x:c*STEP,y:startY+HEADER+coords.get(m.id),key});
  blocks.push({key,title,y:startY,rounds:rounds.map((r,i)=>({r,x:i*STEP,label:`Tour ${i+1}`}))});
  return startY+HEADER+bottom+SECTION_GAP;
 }
 let nextY=addTrack(upper,'upper','Tableau principal — vainqueurs',0);
 // Shift the whole winners' tree so its last match sits directly before GF.
 const upperShift=(lastCore-(upperRounds.length-1))*STEP;
 if(upperShift>0){for(const pos of positions.values())if(pos.key==='upper')pos.x+=upperShift;const block=blocks.find(b=>b.key==='upper');if(block)block.rounds.forEach(r=>r.x+=upperShift);}
 nextY=addTrack(lower,'lower','Tableau des perdants — rattrapage',nextY);
 // Placement branches are laid out as genuine binary trees, including
 // classification below 16th place. Each final occupies the grand-final column.
 const placeById=new Map(places.map(m=>[m.id,m]));
 const placeFinals=places.filter(m=>Number.isInteger(m.place)).sort((a,b)=>a.place-b.place);
 // Une finale par paire de places. Les deux finales issues des mêmes
 // demi-finales partagent leurs sources mais jamais leurs coordonnées.
 // Les rencontres amont se centrent entre toutes leurs finales descendantes.
 const placementTop=nextY+HEADER;
 // Reserve a separate row for EVERY placement final, including 9-10,
 // 13-14 and 17-18; never infer the visible matches from only winner links.
 const finalYs=new Map(placeFinals.map((m,i)=>[m.id,placementTop+i*ROW]));
 const descendants=new Map();
 const visit=(id,finalId,seen=new Set())=>{
  if(seen.has(id))return;seen.add(id);
  if(!descendants.has(id))descendants.set(id,new Set());
  descendants.get(id).add(finalId);
  const m=placeById.get(id);if(!m)return;
  for(const src of [m.sourceA,m.sourceB])if(placeById.has(src?.id))visit(src.id,finalId,seen);
 };
 for(const m of placeFinals)visit(m.id,m.id);
 const depths=new Map();
 const depthVisit=(id,d,seen=new Set())=>{
  if(seen.has(id))return;seen.add(id);
  depths.set(id,Math.max(depths.get(id)||0,d));
  const m=placeById.get(id);
  if(m)for(const src of [m.sourceA,m.sourceB])if(placeById.has(src?.id))depthVisit(src.id,d+1,seen);
 };
 for(const m of placeFinals)depthVisit(m.id,0);
 const columns=new Map();
 for(const m of places){
  const finals=[...(descendants.get(m.id)||[])];
  const y=finalYs.has(m.id)?finalYs.get(m.id):finals.length?finals.reduce((sum,id)=>sum+finalYs.get(id),0)/finals.length:placementTop+placeFinals.length*ROW;
  const col=Math.max(0,grandCol-(depths.get(m.id)||0));
  if(!columns.has(col))columns.set(col,[]);
  columns.get(col).push({m,y});
 }
 // Non-final feeder matches can share two descendant finals; separate
 // them vertically while keeping the finals in exact ranking order.
 for(const [col,nodes] of columns){
  nodes.sort((a,b)=>a.y-b.y||a.m.number-b.m.number);
  let previous=-Infinity;
  for(const node of nodes){
   const y=finalYs.has(node.m.id)?node.y:Math.max(node.y,previous+ROW);
   positions.set(node.m.id,{m:node.m,x:col*STEP,y,key:'places'});
   previous=y;
  }
 }
 const leafCursor=placementTop+(placeFinals.length+1)*ROW;
 if(places.length)blocks.push({key:'places',title:'Matchs de classement',y:nextY,rounds:[]});
 // Both grand finals follow the winners' final horizontally, at its exact Y.
 const upperFinal=upper.filter(m=>m.round===Math.max(...upperRounds))[0];
 const finalBase=positions.get(upperFinal?.id)?.y??HEADER+ROW;
 grand.forEach((m,i)=>positions.set(m.id,{m,x:(grandCol+i)*STEP,y:finalBase,key:'grand'}));
 blocks.push({key:'grand',title:'Grande finale et finale décisive',y:0,rounds:[]});
 const width=(resetCol+1)*STEP+20;
 const height=Math.max(leafCursor+24,...[...positions.values()].map(p=>p.y+H+35));
 // Ne tracer QUE les branches internes d'un arbre : les vainqueurs.
 // Les transferts entre tableau principal, rattrapage et classement sont sans trait.
 // Les deux finales partagées par une paire de demi-finales ne sont donc pas
 // reliées par des traits de perdants.
 const hiddenByes=new Set(matches.filter(m=>m.status==='bye'||(m.status==='blocked'&&((m.sourceA?.bye&&m.sourceB?.bye)))).map(m=>m.id));
 const links=[];
 for(const target of positions.values()){
  if(hiddenByes.has(target.m.id))continue;
  const sources=[target.m.sourceA,target.m.sourceB];
  const inbound=[];
  for(let side=0;side<2;side++){
   const src=sources[side];if(!src?.id||src.outcome!=='winner')continue;
   const origin=positions.get(src.id);if(!origin||hiddenByes.has(origin.m.id)||origin.x>=target.x)continue;
   const internal=origin.key===target.key;
   const mainFinal=origin.key==='upper'&&target.key==='grand';
   const resetFinal=origin.key==='grand'&&target.key==='grand';
   if(!internal&&!mainFinal&&!resetFinal)continue;
   inbound.push({origin,side});
  }
  // Deux arrivées au maximum. Si les deux matchs forment une paire, les
  // raccorder au même coude, comme dans l'arbre de classement intégral.
  const x2=target.x,y2=target.y+H/2;
  if(inbound.length===2&&Math.abs(inbound[0].origin.x-inbound[1].origin.x)<2){
   const a=inbound[0].origin,b=inbound[1].origin;
   const x1=a.x+W,mid=x1+(x2-x1)/2;
   const ya=a.y+H/2,yb=b.y+H/2;
   links.push({d:`M${x1} ${ya} H${mid} M${x1} ${yb} H${mid} M${mid} ${Math.min(ya,yb)} V${Math.max(ya,yb)} M${mid} ${(ya+yb)/2} H${x2} V${y2}`,key:`pair-${target.m.id}`});
  }else{
   for(const {origin,side} of inbound){
    const x1=origin.x+W,y1=origin.y+H/2,mid=x1+(x2-x1)/2;
    links.push({d:Math.abs(y2-y1)<2?`M${x1} ${y1} H${x2}`:`M${x1} ${y1} H${mid} V${y2} H${x2}`,key:`${origin.m.id}-${target.m.id}-${side}`});
   }
  }
 }
 const labels=src=>{
  if(!src)return 'À déterminer';if(src.bye)return 'Exempt';if(src.team)return teams[src.team]?.name||'À déterminer';
  const m=matches.find(x=>x.id===src.id);
  return `${src.outcome==='winner'?'Vainqueur':'Perdant'} du match ${m?.number||'?'}`;
 };
 const fit=()=>setZoom(Math.max(.15,Math.min(1,((viewport.current?.clientWidth||900)-25)/width)));
 return <div className="challongeWrap doubleUnified"><div className="challongeTools"><strong>Double élimination · arbres reliés et classements alignés</strong><div><button onClick={()=>setZoom(z=>Math.max(.15,+(z-.1).toFixed(2)))}>−</button><span>{Math.round(zoom*100)} %</span><button onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(2)))}>+</button><button onClick={()=>setZoom(1)}>100 %</button><button onClick={fit}>Vue complète</button></div></div><div className="challongeViewport unifiedViewport" ref={viewport} role="region" tabIndex="0" aria-label="Tableau complet de double élimination"><div style={{width:width*zoom,height:height*zoom,position:'relative'}}><div className="challongeCanvas" style={{width,height,transform:`scale(${zoom})`,transformOrigin:'top left'}}><svg className="challongeLines" width={width} height={height} aria-hidden="true">{links.map(({d,key})=><path d={d} key={key}/>)}</svg>{blocks.filter(b=>b.key!=='grand').map(b=><React.Fragment key={b.key}><div className="doubleUnifiedHeading" style={{top:b.y,left:0,width}}>{b.title}</div>{b.rounds.map(r=><div className="challongeRoundTitle" key={r.r} style={{left:r.x,top:b.y+30,width:W}}>{r.label}</div>)}</React.Fragment>)}<div className="challongeRoundTitle" style={{left:grandCol*STEP,top:30,width:W}}>Grande finale</div><div className="challongeRoundTitle" style={{left:resetCol*STEP,top:30,width:W}}>Finale décisive</div>{[...positions.values()].filter(({m})=>!hiddenByes.has(m.id)).map(({m,x,y})=>{const win=m.status==='done'?(Number(m.sa)>Number(m.sb)?m.a:m.b):null;return <div className={'challongeMatch '+(m.status==='skipped'?'doubleSkipped':'')} key={m.id} style={{left:x,top:y,width:W}}><div className="challongeMatchHead">{m.place?`Places ${m.place}–${m.place+1}`:m.conditionalReset?'Finale décisive (si nécessaire)':`Match ${m.number}`}<span>{m.status==='playing'?`Terrain ${m.court+1}`:m.status==='done'?'Terminé':m.status==='skipped'?'Non nécessaire':'À venir'}</span></div>{[0,1].map(i=>{const id=i?m.b:m.a;return <div key={i} className={'challongeParticipant '+(win===id&&win?'challongeWinner':'')}><i style={{background:teams[id]?.color||'#a5b9ca'}}/><span>{teams[id]?.name||labels(i?m.sourceB:m.sourceA)}</span><b>{m.status==='done'?(i?m.sb:m.sa):'–'}</b></div>})}</div>})}</div></div></div><p className="bracketHint">Les traits relient uniquement les vainqueurs au sein de leur arbre. Aucun trait de transfert entre tableau principal, rattrapage et classement.</p></div>;
}

// Import autonome de listes Excel (.xlsx) et CSV, sans dépendance externe.
async function readExcelTeams(file){
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 const parseCSV=(content)=>{
  content=content.replace(/^\uFEFF/,'');
  const first=(content.split(/\r?\n/)[0]||'');
  const delimiter=[';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<content.length;i++){
   const c=content[i];if(c==='"'){if(quoted&&content[i+1]==='"'){field+='"';i++}else quoted=!quoted}
   else if(c===delimiter&&!quoted){row.push(field);field=''}
   else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&content[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field=''}
   else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row)}return rows;
 };
 let rows=[];
 if(ext==='csv'||ext==='txt'){
  const buf=await file.arrayBuffer();let content=new TextDecoder('utf-8').decode(buf);
  if(content.includes('\uFFFD'))content=new TextDecoder('windows-1252').decode(buf);
  rows=parseCSV(content);
 }else if(ext==='xlsx'){
  if(typeof DecompressionStream==='undefined')throw Error('Ce navigateur ne prend pas en charge la lecture Excel. Exporte le fichier au format CSV.');
  const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);
  // Lire le répertoire central ZIP (fonctionne aussi avec les fichiers Excel utilisant des data descriptors).
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break}}
  if(end<0)throw Error('Fichier Excel invalide.');
  const entries=new Map();let pos=view.getUint32(end+16,true),count=view.getUint16(end+10,true);
  const decoder=new TextDecoder();
  for(let i=0;i<count;i++){
   if(view.getUint32(pos,true)!==0x02014b50)throw Error('Archive Excel illisible.');
   const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),nameLen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
   const path=decoder.decode(bytes.slice(pos+46,pos+46+nameLen));entries.set(path,{method,size,offset});pos+=46+nameLen+extra+comment;
  }
  async function xmlFile(path){
   const entry=entries.get(path);if(!entry)return null;
   const p=entry.offset;if(view.getUint32(p,true)!==0x04034b50)throw Error('Entrée Excel invalide.');
   const begin=p+30+view.getUint16(p+26,true)+view.getUint16(p+28,true),raw=bytes.slice(begin,begin+entry.size);
   let result=raw;
   if(entry.method===8){const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));result=new Uint8Array(await new Response(stream).arrayBuffer())}
   else if(entry.method!==0)throw Error('Compression Excel non prise en charge.');
   return new DOMParser().parseFromString(new TextDecoder().decode(result),'application/xml');
  }
  const children=(node,name)=>Array.from(node?.getElementsByTagNameNS('*',name)||[]);
  const sharedDoc=await xmlFile('xl/sharedStrings.xml');
  const shared=children(sharedDoc,'si').map(si=>children(si,'t').map(t=>t.textContent||'').join(''));
  const workbook=await xmlFile('xl/workbook.xml');
  const sheet=children(workbook,'sheet')[0];
  let sheetPath='xl/worksheets/sheet1.xml';
  if(sheet){const relId=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
   const rels=await xmlFile('xl/_rels/workbook.xml.rels');const rel=children(rels,'Relationship').find(r=>r.getAttribute('Id')===relId);
   if(rel){const target=rel.getAttribute('Target')||'';sheetPath=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target.replace(/^\.\//,'');}
  }
  const sheetDoc=await xmlFile(sheetPath);if(!sheetDoc)throw Error('Première feuille Excel introuvable.');
  rows=children(sheetDoc,'sheetData').flatMap(data=>children(data,'row').map(r=>{
   const values=[];for(const c of children(r,'c')){
    const ref=c.getAttribute('r')||'',letters=(ref.match(/^[A-Z]+/i)||[])[0]||'A';let index=0;
    for(const letter of letters.toUpperCase())index=index*26+letter.charCodeAt(0)-64;index--;
    const type=c.getAttribute('t');let value='';
    if(type==='inlineStr')value=children(c,'t').map(t=>t.textContent||'').join('');
    else{value=children(c,'v')[0]?.textContent||'';if(type==='s')value=shared[Number(value)]||'';}
    if(index>=0&&index<100)values[index]=value;
   }return values;
  }));
 }else throw Error('Choisis un fichier .xlsx ou .csv (les anciens .xls doivent être enregistrés en .xlsx).');
 const populated=rows.filter(r=>r.some(v=>String(v??'').trim()));
 if(!populated.length)throw Error('Le fichier ne contient aucune équipe.');
 const headers=populated[0].map(v=>String(v??'').trim().toLowerCase());
 let col=headers.findIndex(h=>/^(équipe|equipe|nom de l[’']?équipe|nom de l[’']?equipe|team|team name|nom)$/.test(h));
 const hasHeader=col>=0;
 if(col<0)col=0;
 return populated.slice(hasHeader?1:0).map(r=>String(r[col]??'').trim()).filter(Boolean);
}

function App(){const [s,setS]=useState(load),[name,setName]=useState(''),[tab,setTab]=useState('terrains'),[editing,setEditing]=useState({}),[message,setMessage]=useState('');useEffect(()=>localStorage.setItem('badminton-v1',JSON.stringify(s)),[s]);const cfg=settingsOf(s);const [timers,setTimers]=useState({});useEffect(()=>{if(cfg.mode!=='time')return;const interval=setInterval(()=>setTimers(old=>{let changed=false,next={...old};for(const id of s.courtIds){if(id&&next[id]?.running&&next[id].remaining>0){next[id]={...next[id],remaining:next[id].remaining-1};changed=true}}return changed?next:old}),1000);return()=>clearInterval(interval)},[s.courtIds.join(','),cfg.mode]);const clock=id=>{const t=timers[id],sec=t?.remaining??cfg.minutes*60;return <div className="courtTimer"><strong>{String(Math.floor(sec/60)).padStart(2,'0')}:{String(sec%60).padStart(2,'0')}</strong><button onClick={()=>setTimers(old=>({...old,[id]:{remaining:old[id]?.remaining??cfg.minutes*60,running:!old[id]?.running}}))}>{t?.running?'Pause':'Démarrer'}</button><button onClick={()=>setTimers(old=>({...old,[id]:{remaining:cfg.minutes*60,running:false}}))}>↺</button></div>};const teams=Object.fromEntries(s.teams.map(t=>[t.id,t]));const active=s.matches.filter(m=>m.phase===(s.phase==='final'?'final':'pool'));const waiting=active.filter(m=>m.status==='waiting'||m.status==='blocked');const done=active.filter(m=>m.status==='done');const poolGroups=Array.from({length:s.pools},(_,p)=>s.teams.filter(t=>s.poolAssignments?.[t.id]===p));const announce=x=>{setMessage(x);setTimeout(()=>setMessage(''),4500)};
function schedule(state){
 const next={...state,matches:state.matches.map(m=>({...m})),courtIds:[...state.courtIds]};
 const phase=next.phase==='final'?'final':'pool';
 const finished=next.matches.filter(m=>m.phase===phase&&m.status==='done');
 const playing=next.matches.filter(m=>m.status==='playing');
 const busy=new Set(playing.flatMap(m=>[m.a,m.b]));
 const played=new Map(),last=new Map(),total=new Map(),completed=new Map();
 const lastOrder=Math.max(0,...finished.map(m=>m.finishedOrder||0));
 for(const m of next.matches.filter(m=>m.phase===phase)){
  const branch=phase==='pool'?`pool:${m.pool}`:`${m.groupKey||m.bracket||m.section||m.round||'final'}`;
  if(m.a&&m.b)total.set(branch,(total.get(branch)||0)+1);
  if(m.status==='done'){
   completed.set(branch,(completed.get(branch)||0)+1);
   for(const id of [m.a,m.b]){played.set(id,(played.get(id)||0)+1);last.set(id,Math.max(last.get(id)||0,m.finishedOrder||0));}
  }
 }
 // On tient compte des matchs déjà affectés aux terrains, et pas seulement du dernier terminé.
 const justFinished=new Set(finished.filter(m=>(m.finishedOrder||0)===lastOrder).flatMap(m=>[m.a,m.b]));
 for(let c=0;c<next.courtIds.length;c++){
  if(next.courtIds[c])continue;
  const ready=next.matches.filter(m=>m.status==='waiting'&&m.phase===phase&&m.a&&m.b&&!busy.has(m.a)&&!busy.has(m.b));
  if(!ready.length)continue;
  const branch=m=>phase==='pool'?`pool:${m.pool}`:`${m.groupKey||m.bracket||m.section||m.round||'final'}`;
  const progress=m=>(completed.get(branch(m))||0)/Math.max(1,total.get(branch(m))||1);
  const count=m=>(played.get(m.a)||0)+(played.get(m.b)||0);
  const recent=m=>Number(justFinished.has(m.a))+Number(justFinished.has(m.b));
  const wait=m=>Math.max(0,lastOrder-(last.get(m.a)||0))+Math.max(0,lastOrder-(last.get(m.b)||0));
  // Éviter une reprise immédiate si un autre match peut jouer; puis équilibrer
  // les branches et favoriser les équipes qui attendent depuis longtemps.
  ready.sort((a,b)=>recent(a)-recent(b)||progress(a)-progress(b)||count(a)-count(b)||wait(b)-wait(a)||String(a.id).localeCompare(String(b.id)));
  const m=ready[0];m.status='playing';m.court=c;next.courtIds[c]=m.id;busy.add(m.a);busy.add(m.b);
 }
 return next;
}
function chooseCourtMatch(court,matchId){
 setS(old=>{
  if(old.phase==='setup')return old;
  const next={...old,matches:old.matches.map(m=>({...m})),courtIds:[...old.courtIds]};
  const selected=next.matches.find(m=>m.id===matchId);
  if(!selected||selected.status!=='waiting'||!selected.a||!selected.b)return old;
  const currentId=next.courtIds[court];
  const occupied=new Set(next.matches.filter(m=>m.status==='playing'&&m.id!==currentId).flatMap(m=>[m.a,m.b]));
  if(occupied.has(selected.a)||occupied.has(selected.b))return old;
  if(currentId){const previous=next.matches.find(m=>m.id===currentId);if(previous){previous.status='waiting';previous.court=null;}}
  selected.status='playing';selected.court=court;next.courtIds[court]=selected.id;
  return next;
 });
}

function startPools(){
 if(s.teams.length<2||s.pools<1||s.pools>Math.floor(s.teams.length/2)){announce('Prévoir au moins deux équipes par poule.');return}
 const assignments=Object.fromEntries(s.teams.map((t,i)=>[t.id,Number.isInteger(s.poolDraft?.[t.id])&&s.poolDraft[t.id]<s.pools?s.poolDraft[t.id]:i%s.pools]));
 const buckets=Array.from({length:s.pools},()=>[]);s.teams.forEach(t=>buckets[assignments[t.id]].push(t));
 if(buckets.some(b=>b.length<2)){announce('Chaque poule doit contenir au moins deux équipes. Modifie la répartition avant de lancer.');return}
 const matches=[];buckets.forEach((arr,p)=>{for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++)matches.push({id:uid(),a:arr[i].id,b:arr[j].id,pool:p,phase:'pool',status:'waiting',sa:'',sb:'',court:null})});
 setS(schedule({...s,poolDraft:assignments,poolAssignments:assignments,matches,phase:'pool',courtIds:Array(cfg.courts).fill(null),finalRounds:[]}));setTab('terrains')
}
function shufflePools(){
 const shuffled=[...s.teams].sort(()=>Math.random()-.5);
 const assignments=Object.fromEntries(shuffled.map((t,i)=>[t.id,i%s.pools]));
 setS(old=>({...old,poolDraft:assignments}));announce('Répartition automatique créée : tu peux maintenant déplacer les équipes.');
}
function assignPool(teamId,pool){setS(old=>({...old,poolDraft:{...Object.fromEntries(old.teams.map((t,i)=>[t.id,Number.isInteger(old.poolDraft?.[t.id])&&old.poolDraft[t.id]<old.pools?old.poolDraft[t.id]:i%old.pools])),[teamId]:pool}}))}

function saveMatch(id){let m=s.matches.find(x=>x.id===id),e=editing[id]||{sa:m.sa,sb:m.sb};if(!valid(e.sa,e.sb,cfg)){announce('Score invalide selon les règles configurées.');return}setS(prev=>{let next={...prev,matches:prev.matches.map(x=>({...x})),courtIds:[...prev.courtIds],finalGroups:(prev.finalGroups||[]).map(g=>({...g,ids:[...g.ids],matchIds:[...g.matchIds],byeIds:[...g.byeIds]})),finalRounds:(prev.finalRounds||[]).map(r=>[...r]),finalPositions:{...(prev.finalPositions||{})}};let target=next.matches.find(x=>x.id===id);target.sa=String(e.sa);target.sb=String(e.sb);target.status='done';next.recentTeams=[target.a,target.b];target.finishedOrder=(Math.max(0,...next.matches.map(z=>z.finishedOrder||0))+1);if(target.court!==null)next.courtIds[target.court]=null;target.court=null;if(next.phase==='final'&&next.double){doubleAdvance(next)}else if(next.phase==='final'){if(next.prelimIds?.length&&!next.prelimFinished&&next.prelimIds.every(pid=>next.matches.find(z=>z.id===pid)?.status==='done')){next.prelimFinished=true;const results=next.prelimIds.map(pid=>next.matches.find(z=>z.id===pid));const winners=results.map(z=>+z.sa>+z.sb?z.a:z.b);const losers=results.map(z=>+z.sa>+z.sb?z.b:z.a);const power=next.prelimDirect.length+winners.length;createGroup(next,[...next.prelimDirect,...winners],1,0,'F');createGroup(next,losers,power+1,0,'P');}advanceGroups(next)}return schedule(next)});setEditing(v=>{let a={...v};delete a[id];return a});setTimers(v=>{let a={...v};delete a[id];return a})}
function beginFinal(){
 if(cfg.format==='poolsDouble'){
  if(s.matches.some(m=>m.phase==='pool'&&m.status!=='done')){announce('Terminer tous les matchs de poules.');return}
  const standings=poolGroups.map(g=>ranks(g,s.matches.filter(m=>m.phase==='pool')));
  const ordered=[];for(let i=0;ordered.length<s.teams.length;i++)for(const group of standings)if(group[i])ordered.push(group[i].id);
  if(ordered.length<2){announce('Il faut au moins deux équipes.');return}
  const next={...s,phase:'final',matches:[...s.matches],courtIds:Array(cfg.courts).fill(null),finalSize:ordered.length,finalPositions:{},finalGroups:[],finalRounds:[]};
  doubleStart(next,avoidPoolRematches(ordered,s.poolAssignments));setS(schedule(next));setTab('tableau');announce('Double élimination créée à partir du classement des poules.');return;
 }
if(s.matches.some(m=>m.phase==='pool'&&m.status!=='done')){announce('Terminer tous les matchs de poules.');return}const standings=poolGroups.map(g=>ranks(g,s.matches.filter(m=>m.phase==='pool')));let order=[];for(let i=0;order.length<s.teams.length;i++)for(let group of standings)if(group[i])order.push(group[i].id);if(order.length<2)return;let n=order.length,power=2**Math.floor(Math.log2(n)),prelimCount=n-power;let state={...s,phase:'final',courtIds:Array(cfg.courts).fill(null),finalRounds:[],finalSize:n,finalGroups:[],finalPositions:{},prelimIds:[],prelimDirect:[],prelimFinished:prelimCount===0,matches:[...s.matches]};if(prelimCount){const direct=order.slice(0,power-prelimCount);const contestants=order.slice(power-prelimCount);state.prelimDirect=direct;for(let i=0;i<contestants.length;i+=2){let m={id:uid(),a:contestants[i],b:contestants[i+1],phase:'final',round:-1,groupKey:'PRE',status:'waiting',sa:'',sb:'',court:null};state.matches.push(m);state.prelimIds.push(m.id)}}else createGroup(state,order,1,0,'F');setS(schedule(state));setTab('tableau');announce(prelimCount?`${prelimCount} matchs préliminaires programmés sur les terrains.`:'Phase finale prête sur les terrains.')}
function launchTournament(){
 if(s.phase!=='setup')return;
 if(s.teams.length<2){announce('Il faut au moins deux équipes.');return}
 if(['integral','pools','poolsDouble'].includes(cfg.format)){startPools();return}
 if(cfg.format==='league'){
  const matches=[];for(let i=0;i<s.teams.length;i++)for(let j=i+1;j<s.teams.length;j++)matches.push({...doubleMatch(s.teams[i].id,s.teams[j].id,'Championnat',0),phase:'pool',pool:0});
  setS(schedule({...s,phase:'pool',pools:1,poolAssignments:Object.fromEntries(s.teams.map(t=>[t.id,0])),matches,courtIds:Array(cfg.courts).fill(null)}));setTab('terrains');return;
 }
 if(cfg.format==='double'){
  let next={...s,phase:'final',matches:[],courtIds:Array(cfg.courts).fill(null),finalSize:s.teams.length,finalPositions:{},finalGroups:[],finalRounds:[]};doubleStart(next,s.teams.map(t=>t.id));setS(schedule(next));setTab('tableau');return;
 }
}
function changeConfig(key,value){if(s.phase!=='setup')return;setS(old=>({...old,settings:{...settingsOf(old),[key]:value},courtIds:key==='courts'?Array(value).fill(null):old.courtIds}))}
function reset(){if(confirm('Effacer ce tournoi et repartir de zéro ?')){setS(init());setEditing({});setTab('terrains')}}
function addTeam(){let v=name.trim();if(!v)return;if(s.teams.some(t=>t.name.toLowerCase()===v.toLowerCase())){announce('Nom déjà utilisé.');return}setS(x=>({...x,teams:[...x.teams,{id:uid(),name:v,color:palette[x.teams.length%palette.length]}]}));setName('')}
async function importTeamsExcel(file){
 if(!file)return;
 if(s.phase!=='setup'){announce('Import possible uniquement avant le lancement du tournoi.');return}
 try{
  const names=await readExcelTeams(file);
  const existing=new Set(s.teams.map(t=>t.name.trim().toLocaleLowerCase('fr')));
  const unique=[];let duplicates=0;
  for(const raw of names){const name=raw.replace(/\s+/g,' ').trim(),key=name.toLocaleLowerCase('fr');if(!name||existing.has(key)){duplicates++;continue}existing.add(key);unique.push(name)}
  if(!unique.length){announce('Aucune nouvelle équipe : '+duplicates+' doublon(s) ignoré(s).');return}
  setS(old=>({...old,teams:[...old.teams,...unique.map((name,i)=>({id:uid(),name,color:palette[(old.teams.length+i)%palette.length]}))]}));
  announce(unique.length+' équipe(s) importée(s)'+(duplicates?' · '+duplicates+' doublon(s) ignoré(s)':'')+'. Tu peux maintenant ajuster les poules.');
 }catch(error){announce(error.message||'Impossible de lire ce fichier Excel.')} 
}
function exportData(){let blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tournoi-badminton.json';a.click();URL.revokeObjectURL(url)}
function importData(file){if(!file)return;file.text().then(t=>{try{let obj=JSON.parse(t);if(!Array.isArray(obj.teams)||!Array.isArray(obj.matches)||!Array.isArray(obj.courtIds))throw Error();setS(obj);announce('Tournoi importé.')}catch{announce('Fichier de sauvegarde invalide.')}})}
function score(m){let e=editing[m.id]||{sa:m.sa,sb:m.sb};return <div className="scorebar"><input aria-label="Score équipe 1" type="number" min="0" max="21" value={e.sa} onChange={v=>setEditing(x=>({...x,[m.id]:{...e,sa:v.target.value}}))}/><span>—</span><input aria-label="Score équipe 2" type="number" min="0" max="21" value={e.sb} onChange={v=>setEditing(x=>({...x,[m.id]:{...e,sb:v.target.value}}))}/><button onClick={()=>saveMatch(m.id)}>Valider</button></div>}
function matchup(m){return <div className="matchnames"><span><i style={{background:teams[m.a]?.color}}/>{teams[m.a]?.name||'À déterminer'}</span><b>VS</b><span><i style={{background:teams[m.b]?.color}}/>{teams[m.b]?.name||'À déterminer'}</span></div>}
const finalStandings=useMemo(()=>s.phase!=='final'?[]:Array.from({length:s.finalSize},(_,i)=>({place:i+1,team:teams[s.finalPositions?.[i+1]]||null,status:s.finalPositions?.[i+1]?'done':'pending'})),[s]);
const bracketPlan=useMemo(()=>plannedBracket(s,teams),[s]);
const finalFinished=finalStandings.length>0&&finalStandings.every(x=>x.status==='done');
const classificationPaths=useMemo(()=>{
 const all=bracketPlan.flatMap(stage=>stage.matches);
 const roots=[...new Set(all.map(m=>m.path).filter(path=>path&&(path==='P'||(path.endsWith('L')&&path.startsWith('F')))))];
 const power=2**Math.floor(Math.log2(Math.max(2,s.finalSize||2)));
 return roots.map(path=>{
  let start=1,size=power;
  if(path==='P'){start=power+1;size=(s.finalSize||power)-power;}
  else for(const outcome of path.slice(1)){size=Math.max(1,size/2);if(outcome==='L')start+=size;}
  const finish=Math.min(s.finalSize,start+Math.max(1,size)-1);
  return {path,label:`Match places ${start}–${Math.min(start+1,finish)}`,start,finish};
 }).sort((a,b)=>a.start-b.start||a.path.length-b.path.length||a.path.localeCompare(b.path));
},[bracketPlan,s.finalSize]);


return <div className="app"><header><div className="brand"><div className="logo"><img src={headerMark} alt="Logo Badminton Manager" /></div><div><h1>BADMINTON <em>MANAGER</em></h1><p>Gestion de tournoi · {cfg.courts} terrains</p></div></div><div className="headerRight"><span className="pill">{s.phase==='setup'?'Configuration':s.phase==='pool'?'Phase de poules':'Classement intégral'}</span><button className="ghost" onClick={exportData}>↓ Sauvegarder</button><label className="upload">↑ Importer<input type="file" accept="application/json" onChange={e=>importData(e.target.files[0])}/></label></div></header><main><div className="heading"><div><h2>{s.title}</h2><p>{s.teams.length} équipes · {s.pools} poules · {done.length}/{active.length} matchs terminés</p></div><button className="danger" onClick={reset}>Nouveau tournoi</button></div><nav>{[['gestion','⚙ Gestion du tournoi'],['equipes','♟ Équipes'],['terrains','▦ Terrains'],['poules','◫ Poules'],['tableau','⌁ Tableau final'],['classement','🏆 Classement général']].map(([key,label])=><button key={key} className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>{message&&<div className="notice">{message}</div>}
{tab==='gestion'&&<section className="panel managePanel"><h3>Gestion du tournoi</h3><p>Configure le tournoi avant son lancement. Les règles sont verrouillées dès que les rencontres commencent pour protéger les résultats.</p><div className="manageGrid"><label>Format du tournoi<select disabled={s.phase!=='setup'} value={cfg.format} onChange={e=>changeConfig('format',e.target.value)}><option value="integral">Poules + classement intégral</option><option value="pools">Poules uniquement</option><option value="league">Championnat — toutes les équipes</option><option value="double">Double élimination + classement</option><option value="poolsDouble">Poules → double élimination (toutes les équipes)</option></select></label><label>Nombre de terrains<input type="number" min="1" max="16" disabled={s.phase!=='setup'} value={cfg.courts} onChange={e=>changeConfig('courts',Math.min(16,Math.max(1,Number(e.target.value)||1)))}/></label><label>Mode de jeu<select disabled={s.phase!=='setup'} value={cfg.mode} onChange={e=>changeConfig('mode',e.target.value)}><option value="points">Aux points</option><option value="time">Au temps</option></select></label>{cfg.mode==='points'?<><label>Points à atteindre<input type="number" min="1" max="99" disabled={s.phase!=='setup'} value={cfg.points} onChange={e=>changeConfig('points',Math.min(99,Math.max(1,Number(e.target.value)||1)))}/></label><label>Fin du match<select disabled={s.phase!=='setup'} value={cfg.winByTwo?'two':'dry'} onChange={e=>changeConfig('winByTwo',e.target.value==='two')}><option value="dry">Points secs</option><option value="two">2 points d’écart avec plafond</option></select></label>{cfg.winByTwo&&<label>Plafond<input type="number" min={cfg.points} max="99" disabled={s.phase!=='setup'} value={Math.max(cfg.points,cfg.cap)} onChange={e=>changeConfig('cap',Math.max(cfg.points,Number(e.target.value)||cfg.points))}/></label>}</>:<label>Durée d'un match (minutes)<input type="number" min="1" max="120" disabled={s.phase!=='setup'} value={cfg.minutes} onChange={e=>changeConfig('minutes',Math.min(120,Math.max(1,Number(e.target.value)||1)))}/></label>}{['integral','pools','poolsDouble'].includes(cfg.format)&&<label>Nombre de poules<input type="number" min="1" max={Math.max(1,Math.floor(s.teams.length/2))} disabled={s.phase!=='setup'} value={s.pools} onChange={e=>setS(x=>({...x,pools:Math.max(1,Number(e.target.value)||1)}))}/></label>}</div><p className="muted">{cfg.format==='double'?'Une première défaite envoie dans le tableau des perdants. Une deuxième élimine ; des rencontres supplémentaires départagent les places restantes.':'Les matchs seront automatiquement distribués sur les terrains disponibles.'}</p><button disabled={s.phase!=='setup'} onClick={launchTournament}>▶ Lancer le tournoi</button></section>}
{tab==='equipes'&&<section className="panel"><h3>Inscription des équipes</h3><p>Chaque équipe possède sa propre couleur. Ajoute-les avant de lancer les poules.</p><div className="add"><input disabled={s.phase!=='setup'} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTeam()} placeholder="Nom de l'équipe"/><button disabled={s.phase!=='setup'} onClick={addTeam}>+ Ajouter</button></div><div className="excelImport"><div><strong>Importer des équipes depuis Excel</strong><p>Fichier .xlsx ou .csv · première feuille · colonne « Équipe » ou « Nom » (sinon colonne A). Les doublons sont ignorés.</p></div><label className={'excelImportButton '+(s.phase!=='setup'?'disabled':'')}><span>📄 Choisir un fichier Excel</span><input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={s.phase!=='setup'} onChange={e=>{const file=e.target.files?.[0];importTeamsExcel(file);e.target.value=''}} /></label></div><div className="teamgrid">{s.teams.map(t=><div className="team" key={t.id}><i style={{background:t.color}}/><span>{t.name}</span>{s.phase==='setup'&&<button className="x" onClick={()=>setS(x=>({...x,teams:x.teams.filter(a=>a.id!==t.id)}))}>×</button>}</div>)}</div><p className="muted">Tu peux aussi importer une sauvegarde complète du tournoi en JSON depuis les commandes de sauvegarde.</p></section>}
{tab==='terrains'&&<><div className="scoreHero"><div><small>BADMINTON · {s.phase==='final'?'PHASE FINALE':s.phase==='pool'?'PHASE DE POULES':'PRÉPARATION'}</small><strong>{done.length} <span>/ {active.length} matchs terminés</span></strong></div><div className="heroPoints">{cfg.mode==='time'?cfg.minutes:cfg.points} <span>{cfg.mode==='time'?'MIN':'PTS'}</span></div><div className="heroRule">{cfg.mode==='time'?'Score à la fin du temps':cfg.winByTwo?'2 points d’écart':'Points secs'}<br/>{cfg.mode==='time'?`${cfg.minutes} minutes`:cfg.winByTwo?`Plafond ${Math.max(cfg.cap,cfg.points)}`:`${cfg.points} points`}</div></div><div className="matchDashboard"><div className="courtgrid">{s.courtIds.map((id,i)=>{let m=s.matches.find(x=>x.id===id);let e=m?(editing[m.id]||{sa:m.sa||'0',sb:m.sb||'0'}):null;let adjust=(side,delta)=>{if(!m)return;setEditing(old=>{let current=old[m.id]||{sa:m.sa||'0',sb:m.sb||'0'};return {...old,[m.id]:{...current,[side]:String(Math.max(0,Math.min(cfg.mode==='points'?Math.max(cfg.points,cfg.cap):999,(Number(current[side])||0)+delta)))}}})};return <article className="court" key={i}><div className="courtHead"><strong>🏸 TERRAIN {i+1}{m&&<small className="courtStageLabel"> · {matchStageLabel(m,s.matches)}</small>}</strong><span className={'status '+(m?'live':'')}>{m?'EN COURS':'LIBRE'}</span></div>{s.phase!=='setup'&&<select className="manualCourtSelect" aria-label={'Choisir le match du terrain '+(i+1)} value={id||''} onChange={e=>chooseCourtMatch(i,e.target.value)}><option value="">{m?'Match en cours':'Choisir un match'}</option>{m&&<option value={m.id}>Actuel : {teams[m.a]?.name} / {teams[m.b]?.name}</option>}{s.matches.filter(x=>x.status==='waiting'&&x.phase===(s.phase==='final'?'final':'pool')&&x.a&&x.b&&!s.matches.some(z=>z.status==='playing'&&z.id!==id&&[z.a,z.b].some(t=>t===x.a||t===x.b))).map(x=><option key={x.id} value={x.id}>{x.phase==='pool'?`Poule ${String.fromCharCode(65+x.pool)} · `:''}{teams[x.a]?.name} / {teams[x.b]?.name}</option>)}</select>}<div className="pitch"><svg className="badmintonLines" viewBox="0 0 600 260" preserveAspectRatio="none" aria-label="Tracé réglementaire d’un terrain de badminton, lignes de simple et de double"><rect x="18" y="16" width="564" height="228"/><path d="M18 36H582 M18 224H582"/><path d="M75 16V244 M525 16V244"/><path d="M238 16V244 M362 16V244"/><path d="M75 130H238 M362 130H525"/><path className="net" d="M300 9V251"/></svg>{m?<><div className="courtTeam left" style={{borderBottomColor:teams[m.a]?.color}}>{teams[m.a]?.name}</div><div className="courtTeam right" style={{borderBottomColor:teams[m.b]?.color}}>{teams[m.b]?.name}</div><div className="courtScore left">{String(e.sa).padStart(2,'0')}</div><div className="courtScore right">{String(e.sb).padStart(2,'0')}</div><div className="vsBall">VS</div>{cfg.mode==='time'&&clock(m.id)}<div className="courtControls left"><button aria-label="Retirer un point équipe gauche" onClick={()=>adjust('sa',-1)}>−</button><button className="plus" onClick={()=>adjust('sa',1)}>+1</button></div><div className="courtControls right"><button aria-label="Retirer un point équipe droite" onClick={()=>adjust('sb',-1)}>−</button><button className="plus" onClick={()=>adjust('sb',1)}>+1</button></div><div className="courtBottom"><span>{cfg.mode==='time'?`${cfg.minutes} min`:`${cfg.points} points`}</span><button onClick={()=>saveMatch(m.id)}>✓ Terminer le match</button></div></>:<div className="courtEmpty">En attente d’une rencontre</div>}</div></article>})}</div><aside className="queuePanel"><div className="queueTitle"><small>PROCHAINES RENCONTRES</small><h3>Matchs en attente <span>{waiting.length}</span></h3><p>Un match disponible arrive automatiquement sur le terrain libéré.</p></div>{s.phase==='setup'?<div className="empty">Configure les poules pour commencer.</div>:waiting.length===0?<div className="empty">Aucun match en attente.</div>:<div className="queue">{waiting.map((m,i)=>{const occupied=new Set(s.matches.filter(x=>x.status==='playing').flatMap(x=>[x.a,x.b]));const ready=Boolean(m.a&&m.b&&!occupied.has(m.a)&&!occupied.has(m.b));return <div className={`queueItem ${ready?'queueReady':'queueWaiting'}`} key={m.id}><div className="queueMeta"><small>{m.phase==='pool'?`Poule ${String.fromCharCode(65+m.pool)}`:`Tour ${m.round+1}`} · Match {m.number||i+1}</small><strong>{ready?'Joueurs prêts':'En attente des joueurs'}</strong></div><div className="queueTeams"><span style={{borderLeftColor:teams[m.a]?.color||'#9ba7b6'}}>{teams[m.a]?.name||'À déterminer'}</span><b>VS</b><span style={{borderLeftColor:teams[m.b]?.color||'#9ba7b6'}}>{teams[m.b]?.name||'À déterminer'}</span></div><em>{ready?'En attente d’un terrain':'Joueurs indisponibles pour le moment'}</em></div>})}</div>}</aside></div></>}
{tab==='poules'&&<><section className="panel"><div className="sectionHead"><h3>Phase de poules</h3>{s.phase==='setup'&&['integral','pools','poolsDouble'].includes(cfg.format)&&<button onClick={startPools}>▶ Générer et lancer les poules</button>}</div>{s.phase==='setup'&&<div className="settings"><label>Nombre de poules <input type="number" min="1" max={Math.max(1,Math.floor(s.teams.length/2))} value={s.pools} onChange={e=>setS(x=>({...x,pools:Math.max(1,Number(e.target.value)||1)}))}/></label><p>Répartition automatique modifiable avant le lancement. Chaque équipe rencontre les autres équipes de sa poule.</p></div>}{s.phase==='setup'&&['integral','pools','poolsDouble'].includes(cfg.format)&&<div className="poolDraft"><div className="poolDraftHeader"><div><h4>Composition des poules</h4><p>Répartition automatique initiale. Déplace librement chaque équipe dans la poule de ton choix, puis lance les matchs.</p></div><button type="button" onClick={shufflePools}>↻ Nouveau tirage automatique</button></div><div className="poolDraftGrid">{Array.from({length:s.pools},(_,p)=>{const members=s.teams.filter((t,i)=>(Number.isInteger(s.poolDraft?.[t.id])&&s.poolDraft[t.id]<s.pools?s.poolDraft[t.id]:i%s.pools)===p);return <div className="poolDraftCard" key={p}><h4>Poule {String.fromCharCode(65+p)} <small>{members.length} équipes</small></h4>{members.map(t=><div className="poolDraftTeam" key={t.id}><i style={{background:t.color}}/><span>{t.name}</span><select aria-label={'Poule de '+t.name} value={p} onChange={e=>assignPool(t.id,Number(e.target.value))}>{Array.from({length:s.pools},(_,k)=><option value={k} key={k}>Poule {String.fromCharCode(65+k)}</option>)}</select></div>)}{members.length===0&&<p className="muted">Aucune équipe</p>}</div>})}</div><p className="muted">Chaque poule doit contenir au moins deux équipes pour démarrer. La composition est enregistrée avec le tournoi.</p></div>}{s.phase!=='setup'&&<div className="poolgrid">{poolGroups.map((group,p)=><div className="pool" key={p}><h4>POULE {String.fromCharCode(65+p)}</h4><table><thead><tr><th>Équipe</th><th>J</th><th>V</th><th>Diff.</th></tr></thead><tbody>{ranks(group,s.matches.filter(m=>m.phase==='pool')).map(t=><tr key={t.id}><td><i style={{background:t.color}}/>{t.name}</td><td>{t.played}</td><td>{t.w}</td><td>{t.pf-t.pa}</td></tr>)}</tbody></table></div>)}</div>}{s.phase==='pool'&&['integral','poolsDouble'].includes(cfg.format)&&<div className="actions"><button onClick={beginFinal}>Créer le tableau final →</button><span>Tous les matchs des poules doivent être terminés.</span></div>}</section></>}
{tab==='tableau'&&<section className="panel"><div className="sectionHead"><h3>{cfg.format==='poolsDouble'||cfg.format==='double'?'Tableau à double élimination':'Tableau de classement intégral'}</h3>{s.phase==='pool'&&['integral','poolsDouble'].includes(cfg.format)&&<button onClick={beginFinal}>Créer le tableau final →</button>}</div>{s.phase!=='final'?<div className="empty">Le tableau apparaît après le lancement d'une phase finale.</div>:<><p>Les gagnants et les perdants poursuivent chacun dans leur branche. Les exempts avancent automatiquement et les rencontres disponibles sont envoyées sur les terrains.</p><div className="bracketLegend"><span>● Victoire → places supérieures</span><span>● Défaite → tableau de classement inférieur</span></div><div className="bracketSections">{s.double?<DoubleBracket matches={s.matches.filter(m=>m.phase==='final')} teams={teams}/>:<UnifiedBracket stages={bracketPlan} teams={teams} classificationPaths={classificationPaths}/>}</div><p className="bracketHint">← Faites glisser horizontalement pour consulter les tours suivants →</p><div className="finalCourtAction"><strong>🏸 Les matchs du tableau final se jouent sur les quatre terrains.</strong><button onClick={()=>setTab('terrains')}>Voir les terrains et saisir les scores →</button></div></>}</section>}
{tab==='classement'&&<section className="panel podiumPanel"><div className="sectionHead"><h3>🏆 Classement général</h3></div>{s.phase!=='final'&&cfg.format!=='league'&&cfg.format!=='pools'?<div className="empty">Le classement général sera disponible dès le lancement de la phase finale.</div>:<><div className="podiumHero"><div className="podiumHeading"><span>✦ PALMARÈS ✦</span><h2>Les champions du tournoi</h2><p>Le podium se dévoile au fil des résultats</p></div>{finalFinished&&<div className="podiumConfetti" aria-hidden="true">{Array.from({length:34},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i*0.23)%4}s`,background:['#b7ff34','#ffffff','#58baff','#ffd86a','#ff78c5'][i%5]}}/>)}</div>}<div className="podiumStage">{[2,1,3].map(place=>{const entry=(s.phase==='final'?finalStandings:ranks(s.teams,s.matches).map((team,i)=>({place:i+1,team,status:'done'}))).find(x=>x.place===place);return <div key={place} className={'podiumEntry podiumPlace'+place}><div className="podiumMedal">{place===1?'🥇':place===2?'🥈':'🥉'}</div><div className="podiumName" style={{borderColor:entry?.team?.color||'#61758b'}}>{entry?.team?.name||'À déterminer'}</div><div className="podiumStep"><strong>{place}</strong><small>{place===1?'CHAMPION':place===2?'VICE-CHAMPION':'3e PLACE'}</small></div></div>})}</div></div><div className="finalRankingHead"><h3>Classement général — 4 à {s.finalSize||s.teams.length}</h3><span>{finalStandings.filter(x=>x.status==='done').length}/{s.finalSize} places attribuées</span></div><p className="muted">Chaque place est déterminée par un match de classement. Les places encore indécises sont indiquées ci-dessous.</p><div className="finalRanking">{(s.phase==='final'?finalStandings:ranks(s.teams,s.matches).map((team,i)=>({place:i+1,team,status:'done'}))).filter(item=>item.place>=4).map(item=><div className={'finalRankRow '+(item.status==='done'?'rankKnown':'rankPending')} key={item.place}><strong className="rankNumber">{item.place}{item.place===1?' 🏆':''}</strong><i className="rankColor" style={{background:item.team?.color||'#aeb9c8'}}/><span>{item.team?.name||'À déterminer'}</span>{item.status==='done'&&<b>Classé</b>}</div>)}</div>{finalFinished&&<div className="finalComplete">🏆 Tournoi terminé : toutes les équipes sont classées !</div>}</>}</section>}
 <footer>Badminton Manager · Données sauvegardées sur cet appareil · Règles personnalisables · {cfg.courts} terrains</footer></main></div>}
createRoot(document.getElementById('root')).render(<App/>);
