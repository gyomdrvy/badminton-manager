import headerMark from './assets/header-mark.png';

import React,{useEffect,useMemo,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import './style.css';
const palette=['#2563eb','#e11d48','#d97706','#16a34a','#9333ea','#0891b2','#ea580c','#be185d','#4f46e5','#65a30d','#dc2626','#0d9488','#7c3aed','#ca8a04','#0284c7','#b45309'];
const uid=()=>Math.random().toString(36).slice(2,10);const initialNames=['Volants Bleus','Smashers','Éclairs','Dragons','Faucons','Titans','Rockets','Panthers'];
const defaults={courts:4,format:'integral',mode:'points',points:15,winByTwo:true,cap:21,minutes:10};
const settingsOf=s=>({...defaults,...(s.settings||{})});
const init=()=>({settings:{...defaults},title:'Tournoi de badminton',teams:initialNames.map((name,i)=>({id:uid(),name,color:palette[i]})),pools:2,phase:'setup',matches:[],courtIds:[null,null,null,null],finalRounds:[],finalSize:0});
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
 const viewport=useRef(null),[zoom,setZoom]=useState(.85);
 const W=222,GAP=42,STEP=118,TOP=128,SECTION_GAP=38,CARD_H=102;
 const roots=[{path:'F',label:'🏆 Tableau principal',start:1},...classificationPaths];
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
  for(const n of nodes)n.y=n.y-minY+TOP;
  const sectionHeight=Math.max(260,...nodes.map(n=>n.y+CARD_H+20));
  const lastStage=Math.max(...nodes.map(n=>n.stageIndex));
  const finalNodes=nodes.filter(n=>n.stageIndex===lastStage);
  const label=root.path==='F'?'🏆 Tableau principal':`🏸 Match places ${root.start}–${Math.min(root.start+1,root.finish||root.start+1)}`;
  sections.push({root,label,columns,nodes,positions,offset,height:sectionHeight,finalNodes});
  offset+=sectionHeight+SECTION_GAP;
 }
 const width=Math.max(600,stages.length*(W+GAP)-GAP+25),height=Math.max(260,offset-SECTION_GAP+10);
 const lines=[];
 for(const section of sections)for(const node of section.nodes)for(const slot of node.entry.slots){
  const m=String(slot.label||'').match(/^Vainqueur du match (\d+)$/i);if(!m)continue;
  const source=section.positions.get(Number(m[1]));if(!source||source.x>=node.x)continue;
  const x1=source.x+W,y1=section.offset+source.y+CARD_H/2,x2=node.x,y2=section.offset+node.y+CARD_H/2,mid=(x1+x2)/2;
  lines.push(`M${x1},${y1} H${mid} V${y2} H${x2}`);
 }
 const fit=()=>{const available=viewport.current?.clientWidth||900;setZoom(Math.max(.15,Math.min(1,(available-30)/width)))};
 return <div className="challongeWrap"><div className="challongeTools"><strong>🏆 Tableau complet · classement intégral</strong><div><button onClick={()=>setZoom(z=>Math.max(.15,+(z-.1).toFixed(2)))}>−</button><span>{Math.round(zoom*100)} %</span><button onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(2)))}>+</button><button onClick={()=>setZoom(1)}>100 %</button><button onClick={fit}>Vue complète</button></div></div><div className="challongeViewport unifiedViewport" ref={viewport} tabIndex="0" role="region" aria-label="Tableau complet, déplaçable horizontalement et verticalement"><div style={{width:width*zoom,height:height*zoom,position:'relative'}}><div className="challongeCanvas" style={{width,height,transform:`scale(${zoom})`,transformOrigin:'top left'}}><svg className="challongeLines" width={width} height={height} aria-hidden="true">{lines.map((d,i)=><path d={d} key={i}/>)}</svg>{sections.map(section=><React.Fragment key={section.root.path}>{section.root.path==='F'&&<div className="unifiedSectionHeading" style={{top:section.offset,left:0,width}}>{section.label}</div>}{section.columns.map(({stageIndex})=><div key={stageIndex} className="challongeRoundTitle" style={{top:section.offset+62,left:stageIndex*(W+GAP),width:W}}>{section.root.path==='F'?titleForStage(stageIndex):stageIndex===section.columns.at(-1).stageIndex?section.label.replace(/^🏸 /,''):`Classement · ${titleForStage(stageIndex)}`}</div>)}{section.nodes.map(({x,y,entry})=>{const m=entry.actual,winner=m?.status==='done'?(+m.sa>+m.sb?m.a:m.b):null;return <div key={entry.number} className="challongeMatch" style={{left:x,top:section.offset+y,width:W}}><div className="challongeMatchHead">Match {entry.number}<span>{m?.status==='playing'?`Terrain ${m.court+1}`:m?.status==='done'?'Terminé':m?'À jouer':'À venir'}</span></div>{entry.slots.map((slot,j)=>{const id=m?.[j?'b':'a']||slot.id;return <div key={j} className={'challongeParticipant '+(winner===id&&winner?'challongeWinner':'')}><i style={{background:teams[id]?.color||'#a5b9ca'}}/><span>{teams[id]?.name||slot.label||'À déterminer'}</span><b>{m?.status==='done'?(j?m.sb:m.sa):'–'}</b></div>})}</div>})}</React.Fragment>)}</div></div></div><p className="bracketHint">Un seul tableau · tour préliminaire compris · classements rangés par places · zoom et déplacement libres.</p></div>;
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
function doubleStart(state,ids){
 if(!isPower(ids.length)){throw Error('La double élimination nécessite 2, 4, 8, 16 ou 32 équipes pour ce tableau.');}
 state.double={planned:true,champion:null,runner:null};
 const wb=[];let entrants=seedOrder(ids.length).map(i=>direct(ids[i-1]));
 for(let r=0;entrants.length>1;r++){
  let round=[];for(let i=0;i<entrants.length;i+=2)round.push(newDoubleNode(state,'upper',r,entrants[i],entrants[i+1]));
  wb.push(round);entrants=round.map(m=>from(m,'winner'));
 }
 const lb=[];
 if(ids.length>2){
  let arrivals=wb[0].map(m=>from(m,'loser'));
  let prev=[];const first=[];
  for(let i=0;i<arrivals.length;i+=2)first.push(newDoubleNode(state,'lower',0,arrivals[i],arrivals[i+1]));
  lb.push(first);prev=first;
  for(let r=1;r<wb.length;r++){
   // Les perdants du tour WB r rejoignent les survivants du rattrapage.
   const inject=[];
   for(let i=0;i<prev.length;i++)inject.push(newDoubleNode(state,'lower',2*r-1,from(prev[i],'winner'),from(wb[r][i],'loser')));
   lb.push(inject);prev=inject;
   if(r<wb.length-1){
    const compact=[];
    for(let i=0;i<prev.length;i+=2)compact.push(newDoubleNode(state,'lower',2*r,from(prev[i],'winner'),from(prev[i+1],'winner')));
    lb.push(compact);prev=compact;
   }
  }
 }
 // Pour n=2, le perdant du seul match WB arrive directement en finale.
 const lastLower=lb.length?lb[lb.length-1][0]:wb[0][0];
 const lowerSource=lb.length?from(lastLower,'winner'):from(lastLower,'loser');
 const gf=newDoubleNode(state,'grand',0,from(wb.at(-1)[0],'winner'),lowerSource);
 const reset=newDoubleNode(state,'grand',1,from(gf,'loser'),from(gf,'winner'),{conditionalReset:true});
 // Matches de classement préconstruits pour chaque cohorte d'élimination.
 const eliminationGroups=lb.map(round=>round.map(m=>from(m,'loser'))).filter(x=>x.length);
 // Le dernier éliminé du repêchage est 3e, l'avant-dernier 4e.
 // Les places 3-4 sont jouées, même si les équipes ont déjà deux défaites.
 if(eliminationGroups.length>=2){
  const last=eliminationGroups.pop(),previous=eliminationGroups.pop();
  if(last.length===1&&previous.length===1){newDoubleNode(state,'places',0,last[0],previous[0],{place:3});}
  else{eliminationGroups.push(previous,last)}
 }
 let nextPlace=5;
 for(const group of eliminationGroups.reverse()){
  if(group.length===1){state.double[`position${nextPlace}`]=group[0];nextPlace++;continue;}
  // Mini-tableau de classement à élimination puis finales de classement.
  const build=(slots,firstPlace,depth)=>{
   if(slots.length===2){newDoubleNode(state,'places',depth,slots[0],slots[1],{place:firstPlace});return;}
   const semis=[];for(let i=0;i<slots.length;i+=2)semis.push(newDoubleNode(state,'places',depth,slots[i],slots[i+1]));
   build(semis.map(m=>from(m,'winner')),firstPlace,depth+1);
   build(semis.map(m=>from(m,'loser')),firstPlace+slots.length/2,depth+1);
  };
  build(group,nextPlace,0);nextPlace+=group.length;
 }
 doubleAdvance(state);return state;
}
function doubleAdvance(state){
 if(!state.double?.planned)return state;
 const byId=Object.fromEntries(state.matches.map(m=>[m.id,m]));
 const resolve=src=>{
  if(!src)return null;if(src.team)return src.team;
  const m=byId[src.id];if(!m||m.status!=='done')return null;
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
   if(a&&b){m.a=a;m.b=b;m.status='waiting';changed=true;}
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
 return state;
}
function DoubleBracket({matches,teams}){
 const viewport=useRef(null),[zoom,setZoom]=useState(1);
 const W=226,H=90,G=55,ROW=112,TOP=63;
 const specs=[{key:'upper',title:'Tableau principal — vainqueurs'},
 {key:'lower',title:'Tableau des perdants — rattrapage'},
 {key:'grand',title:'Grande finale'},
 {key:'places',title:'Matchs de classement'}];
 let yOffset=0;const sections=[];
 for(const spec of specs){
  const ms=matches.filter(m=>m.track===spec.key);if(!ms.length)continue;
  const rounds=[...new Set(ms.map(m=>m.round))].sort((a,b)=>a-b);
  const nodes=[];let maxY=TOP;
  rounds.forEach((r,col)=>{
   const current=ms.filter(m=>m.round===r);
   current.forEach((m,i)=>{const spacing=spec.key==='upper'?ROW*2**col:ROW;
    const y=TOP+i*spacing+(spec.key==='upper'&&col>0?(spacing-ROW)/2:0);
    nodes.push({m,x:col*(W+G),y});maxY=Math.max(maxY,y+H);
   });
  });
  const height=maxY+24;sections.push({...spec,nodes,offset:yOffset,height,rounds});yOffset+=height;
 }
 const width=Math.max(680,...sections.flatMap(sec=>sec.nodes.map(n=>n.x+W+20)));
 const height=Math.max(260,yOffset+12),links=[];
 const positions=new Map(sections.flatMap(sec=>sec.nodes.map(n=>[n.m.id,{...n,y:n.y+sec.offset,key:sec.key}])));
 for(const target of positions.values())for(const src of [target.m.sourceA,target.m.sourceB]){
  if(!src?.id||src.outcome!=='winner')continue;
  const origin=positions.get(src.id);if(!origin||origin.key!==target.key||origin.x>=target.x)continue;
  const x1=origin.x+W,x2=target.x,y1=origin.y+H/2,y2=target.y+H/2,mid=(x1+x2)/2;
  links.push(`M${x1} ${y1} H${mid} V${y2} H${x2}`);
 }
 const labels=src=>{
  if(!src)return 'À déterminer';if(src.team)return teams[src.team]?.name||'À déterminer';
  const m=matches.find(x=>x.id===src.id);
  return `${src.outcome==='winner'?'Vainqueur':'Perdant'} du match ${m?.number||'?'}`;
 };
 const fit=()=>setZoom(Math.max(.2,Math.min(1,((viewport.current?.clientWidth||900)-25)/width)));
 return <div className="challongeWrap doubleUnified"><div className="challongeTools"><strong>Double élimination · tableau complet préétabli</strong><div><button onClick={()=>setZoom(z=>Math.max(.2,+(z-.1).toFixed(2)))}>−</button><span>{Math.round(zoom*100)} %</span><button onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(2)))}>+</button><button onClick={()=>setZoom(1)}>100 %</button><button onClick={fit}>Vue complète</button></div></div><div className="challongeViewport unifiedViewport" ref={viewport} role="region" tabIndex="0" aria-label="Tableau complet de double élimination"><div style={{width:width*zoom,height:height*zoom,position:'relative'}}><div className="challongeCanvas" style={{width,height,transform:`scale(${zoom})`,transformOrigin:'top left'}}><svg className="challongeLines" width={width} height={height} aria-hidden="true">{links.map((d,i)=><path d={d} key={i}/>)}</svg>{sections.map(sec=><React.Fragment key={sec.key}><div className="doubleUnifiedHeading" style={{top:sec.offset,left:0,width}}>{sec.title}</div>{sec.rounds.map((r,i)=><div className="challongeRoundTitle" key={r} style={{left:i*(W+G),top:sec.offset+30,width:W}}>{sec.key==='places'?'Classement':sec.key==='grand'?'Finale':`Tour ${i+1}`}</div>)}{sec.nodes.map(({m,x,y})=>{const win=m.status==='done'?(Number(m.sa)>Number(m.sb)?m.a:m.b):null;return <div className={'challongeMatch '+(m.status==='skipped'?'doubleSkipped':'')} key={m.id} style={{left:x,top:sec.offset+y,width:W}}><div className="challongeMatchHead">{m.place?`Places ${m.place}–${m.place+1}`:m.conditionalReset?'Finale décisive (si nécessaire)':`Match ${m.number}`}<span>{m.status==='playing'?`Terrain ${m.court+1}`:m.status==='done'?'Terminé':m.status==='skipped'?'Non nécessaire':'À venir'}</span></div>{[0,1].map(i=>{const id=i?m.b:m.a;return <div key={i} className={'challongeParticipant '+(win===id&&win?'challongeWinner':'')}><i style={{background:teams[id]?.color||'#a5b9ca'}}/><span>{teams[id]?.name||labels(i?m.sourceB:m.sourceA)}</span><b>{m.status==='done'?(i?m.sb:m.sa):'–'}</b></div>})}</div>})}</React.Fragment>)}</div></div></div><p className="bracketHint">Toutes les rencontres sont affichées dès le départ. Les noms remplacent automatiquement « Vainqueur / Perdant du match ».</p></div>;
}
function App(){const [s,setS]=useState(load),[name,setName]=useState(''),[tab,setTab]=useState('terrains'),[editing,setEditing]=useState({}),[message,setMessage]=useState('');useEffect(()=>localStorage.setItem('badminton-v1',JSON.stringify(s)),[s]);const cfg=settingsOf(s);const [timers,setTimers]=useState({});useEffect(()=>{if(cfg.mode!=='time')return;const interval=setInterval(()=>setTimers(old=>{let changed=false,next={...old};for(const id of s.courtIds){if(id&&next[id]?.running&&next[id].remaining>0){next[id]={...next[id],remaining:next[id].remaining-1};changed=true}}return changed?next:old}),1000);return()=>clearInterval(interval)},[s.courtIds.join(','),cfg.mode]);const clock=id=>{const t=timers[id],sec=t?.remaining??cfg.minutes*60;return <div className="courtTimer"><strong>{String(Math.floor(sec/60)).padStart(2,'0')}:{String(sec%60).padStart(2,'0')}</strong><button onClick={()=>setTimers(old=>({...old,[id]:{remaining:old[id]?.remaining??cfg.minutes*60,running:!old[id]?.running}}))}>{t?.running?'Pause':'Démarrer'}</button><button onClick={()=>setTimers(old=>({...old,[id]:{remaining:cfg.minutes*60,running:false}}))}>↺</button></div>};const teams=Object.fromEntries(s.teams.map(t=>[t.id,t]));const active=s.matches.filter(m=>m.phase===(s.phase==='final'?'final':'pool'));const waiting=active.filter(m=>m.status==='waiting'||m.status==='blocked');const done=active.filter(m=>m.status==='done');const poolGroups=Array.from({length:s.pools},(_,p)=>s.teams.filter(t=>s.poolAssignments?.[t.id]===p));const announce=x=>{setMessage(x);setTimeout(()=>setMessage(''),4500)};
function schedule(state){let next={...state,matches:state.matches.map(m=>({...m})),courtIds:[...state.courtIds]};for(let c=0;c<next.courtIds.length;c++){if(next.courtIds[c])continue;let playing=new Set(next.matches.filter(m=>m.status==='playing').flatMap(m=>[m.a,m.b]));let m=next.matches.find(m=>m.status==='waiting'&&m.phase===(next.phase==='final'?'final':'pool')&&!playing.has(m.a)&&!playing.has(m.b));if(m){m.status='playing';m.court=c;next.courtIds[c]=m.id}}return next}
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

function saveMatch(id){let m=s.matches.find(x=>x.id===id),e=editing[id]||{sa:m.sa,sb:m.sb};if(!valid(e.sa,e.sb,cfg)){announce('Score invalide selon les règles configurées.');return}setS(prev=>{let next={...prev,matches:prev.matches.map(x=>({...x})),courtIds:[...prev.courtIds],finalGroups:(prev.finalGroups||[]).map(g=>({...g,ids:[...g.ids],matchIds:[...g.matchIds],byeIds:[...g.byeIds]})),finalRounds:(prev.finalRounds||[]).map(r=>[...r]),finalPositions:{...(prev.finalPositions||{})}};let target=next.matches.find(x=>x.id===id);target.sa=String(e.sa);target.sb=String(e.sb);target.status='done';if(target.court!==null)next.courtIds[target.court]=null;target.court=null;if(next.phase==='final'&&next.double){doubleAdvance(next)}else if(next.phase==='final'){if(next.prelimIds?.length&&!next.prelimFinished&&next.prelimIds.every(pid=>next.matches.find(z=>z.id===pid)?.status==='done')){next.prelimFinished=true;const results=next.prelimIds.map(pid=>next.matches.find(z=>z.id===pid));const winners=results.map(z=>+z.sa>+z.sb?z.a:z.b);const losers=results.map(z=>+z.sa>+z.sb?z.b:z.a);const power=next.prelimDirect.length+winners.length;createGroup(next,[...next.prelimDirect,...winners],1,0,'F');createGroup(next,losers,power+1,0,'P');}advanceGroups(next)}return schedule(next)});setEditing(v=>{let a={...v};delete a[id];return a});setTimers(v=>{let a={...v};delete a[id];return a})}
function beginFinal(){if(s.matches.some(m=>m.phase==='pool'&&m.status!=='done')){announce('Terminer tous les matchs de poules.');return}const standings=poolGroups.map(g=>ranks(g,s.matches.filter(m=>m.phase==='pool')));let order=[];for(let i=0;order.length<s.teams.length;i++)for(let group of standings)if(group[i])order.push(group[i].id);if(order.length<2)return;let n=order.length,power=2**Math.floor(Math.log2(n)),prelimCount=n-power;let state={...s,phase:'final',courtIds:Array(cfg.courts).fill(null),finalRounds:[],finalSize:n,finalGroups:[],finalPositions:{},prelimIds:[],prelimDirect:[],prelimFinished:prelimCount===0,matches:[...s.matches]};if(prelimCount){const direct=order.slice(0,power-prelimCount);const contestants=order.slice(power-prelimCount);state.prelimDirect=direct;for(let i=0;i<contestants.length;i+=2){let m={id:uid(),a:contestants[i],b:contestants[i+1],phase:'final',round:-1,groupKey:'PRE',status:'waiting',sa:'',sb:'',court:null};state.matches.push(m);state.prelimIds.push(m.id)}}else createGroup(state,order,1,0,'F');setS(schedule(state));setTab('tableau');announce(prelimCount?`${prelimCount} matchs préliminaires programmés sur les terrains.`:'Phase finale prête sur les terrains.')}
function launchTournament(){
 if(s.phase!=='setup')return;
 if(s.teams.length<2){announce('Il faut au moins deux équipes.');return}
 if(cfg.format==='integral'||cfg.format==='pools'){startPools();return}
 if(cfg.format==='league'){
  const matches=[];for(let i=0;i<s.teams.length;i++)for(let j=i+1;j<s.teams.length;j++)matches.push({...doubleMatch(s.teams[i].id,s.teams[j].id,'Championnat',0),phase:'pool',pool:0});
  setS(schedule({...s,phase:'pool',pools:1,poolAssignments:Object.fromEntries(s.teams.map(t=>[t.id,0])),matches,courtIds:Array(cfg.courts).fill(null)}));setTab('terrains');return;
 }
 if(cfg.format==='double'){
  if(!isPower(s.teams.length)){announce('Pour la double élimination, prévoir 2, 4, 8, 16 ou 32 équipes.');return;}
  let next={...s,phase:'final',matches:[],courtIds:Array(cfg.courts).fill(null),finalSize:s.teams.length,finalPositions:{},finalGroups:[],finalRounds:[]};doubleStart(next,s.teams.map(t=>t.id));setS(schedule(next));setTab('tableau');return;
 }
}
function changeConfig(key,value){if(s.phase!=='setup')return;setS(old=>({...old,settings:{...settingsOf(old),[key]:value},courtIds:key==='courts'?Array(value).fill(null):old.courtIds}))}
function reset(){if(confirm('Effacer ce tournoi et repartir de zéro ?')){setS(init());setEditing({});setTab('terrains')}}
function addTeam(){let v=name.trim();if(!v)return;if(s.teams.some(t=>t.name.toLowerCase()===v.toLowerCase())){announce('Nom déjà utilisé.');return}setS(x=>({...x,teams:[...x.teams,{id:uid(),name:v,color:palette[x.teams.length%palette.length]}]}));setName('')}
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
{tab==='gestion'&&<section className="panel managePanel"><h3>Gestion du tournoi</h3><p>Configure le tournoi avant son lancement. Les règles sont verrouillées dès que les rencontres commencent pour protéger les résultats.</p><div className="manageGrid"><label>Format du tournoi<select disabled={s.phase!=='setup'} value={cfg.format} onChange={e=>changeConfig('format',e.target.value)}><option value="integral">Poules + classement intégral</option><option value="pools">Poules uniquement</option><option value="league">Championnat — toutes les équipes</option><option value="double">Double élimination + classement</option></select></label><label>Nombre de terrains<input type="number" min="1" max="16" disabled={s.phase!=='setup'} value={cfg.courts} onChange={e=>changeConfig('courts',Math.min(16,Math.max(1,Number(e.target.value)||1)))}/></label><label>Mode de jeu<select disabled={s.phase!=='setup'} value={cfg.mode} onChange={e=>changeConfig('mode',e.target.value)}><option value="points">Aux points</option><option value="time">Au temps</option></select></label>{cfg.mode==='points'?<><label>Points à atteindre<input type="number" min="1" max="99" disabled={s.phase!=='setup'} value={cfg.points} onChange={e=>changeConfig('points',Math.min(99,Math.max(1,Number(e.target.value)||1)))}/></label><label>Fin du match<select disabled={s.phase!=='setup'} value={cfg.winByTwo?'two':'dry'} onChange={e=>changeConfig('winByTwo',e.target.value==='two')}><option value="dry">Points secs</option><option value="two">2 points d’écart avec plafond</option></select></label>{cfg.winByTwo&&<label>Plafond<input type="number" min={cfg.points} max="99" disabled={s.phase!=='setup'} value={Math.max(cfg.points,cfg.cap)} onChange={e=>changeConfig('cap',Math.max(cfg.points,Number(e.target.value)||cfg.points))}/></label>}</>:<label>Durée d'un match (minutes)<input type="number" min="1" max="120" disabled={s.phase!=='setup'} value={cfg.minutes} onChange={e=>changeConfig('minutes',Math.min(120,Math.max(1,Number(e.target.value)||1)))}/></label>}{['integral','pools'].includes(cfg.format)&&<label>Nombre de poules<input type="number" min="1" max={Math.max(1,Math.floor(s.teams.length/2))} disabled={s.phase!=='setup'} value={s.pools} onChange={e=>setS(x=>({...x,pools:Math.max(1,Number(e.target.value)||1)}))}/></label>}</div><p className="muted">{cfg.format==='double'?'Une première défaite envoie dans le tableau des perdants. Une deuxième élimine ; des rencontres supplémentaires départagent les places restantes.':'Les matchs seront automatiquement distribués sur les terrains disponibles.'}</p><button disabled={s.phase!=='setup'} onClick={launchTournament}>▶ Lancer le tournoi</button></section>}
{tab==='equipes'&&<section className="panel"><h3>Inscription des équipes</h3><p>Chaque équipe possède sa propre couleur. Ajoute-les avant de lancer les poules.</p><div className="add"><input disabled={s.phase!=='setup'} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTeam()} placeholder="Nom de l'équipe"/><button disabled={s.phase!=='setup'} onClick={addTeam}>+ Ajouter</button></div><div className="teamgrid">{s.teams.map(t=><div className="team" key={t.id}><i style={{background:t.color}}/><span>{t.name}</span>{s.phase==='setup'&&<button className="x" onClick={()=>setS(x=>({...x,teams:x.teams.filter(a=>a.id!==t.id)}))}>×</button>}</div>)}</div><p className="muted">Astuce : tu peux aussi importer un tournoi sauvegardé en JSON.</p></section>}
{tab==='terrains'&&<><div className="scoreHero"><div><small>BADMINTON · {s.phase==='final'?'PHASE FINALE':s.phase==='pool'?'PHASE DE POULES':'PRÉPARATION'}</small><strong>{done.length} <span>/ {active.length} matchs terminés</span></strong></div><div className="heroPoints">{cfg.mode==='time'?cfg.minutes:cfg.points} <span>{cfg.mode==='time'?'MIN':'PTS'}</span></div><div className="heroRule">{cfg.mode==='time'?'Score à la fin du temps':cfg.winByTwo?'2 points d’écart':'Points secs'}<br/>{cfg.mode==='time'?`${cfg.minutes} minutes`:cfg.winByTwo?`Plafond ${Math.max(cfg.cap,cfg.points)}`:`${cfg.points} points`}</div></div><div className="matchDashboard"><div className="courtgrid">{s.courtIds.map((id,i)=>{let m=s.matches.find(x=>x.id===id);let e=m?(editing[m.id]||{sa:m.sa||'0',sb:m.sb||'0'}):null;let adjust=(side,delta)=>{if(!m)return;setEditing(old=>{let current=old[m.id]||{sa:m.sa||'0',sb:m.sb||'0'};return {...old,[m.id]:{...current,[side]:String(Math.max(0,Math.min(cfg.mode==='points'?Math.max(cfg.points,cfg.cap):999,(Number(current[side])||0)+delta)))}}})};return <article className="court" key={i}><div className="courtHead"><strong>🏸 TERRAIN {i+1}</strong><span className={'status '+(m?'live':'')}>{m?'EN COURS':'LIBRE'}</span></div><div className="pitch"><svg className="badmintonLines" viewBox="0 0 600 260" preserveAspectRatio="none" aria-label="Tracé réglementaire d’un terrain de badminton, lignes de simple et de double"><rect x="18" y="16" width="564" height="228"/><path d="M18 36H582 M18 224H582"/><path d="M75 16V244 M525 16V244"/><path d="M238 16V244 M362 16V244"/><path d="M75 130H238 M362 130H525"/><path className="net" d="M300 9V251"/></svg>{m?<><div className="courtTeam left" style={{borderBottomColor:teams[m.a]?.color}}>{teams[m.a]?.name}</div><div className="courtTeam right" style={{borderBottomColor:teams[m.b]?.color}}>{teams[m.b]?.name}</div><div className="courtScore left">{String(e.sa).padStart(2,'0')}</div><div className="courtScore right">{String(e.sb).padStart(2,'0')}</div><div className="vsBall">VS</div>{cfg.mode==='time'&&clock(m.id)}<div className="courtControls left"><button aria-label="Retirer un point équipe gauche" onClick={()=>adjust('sa',-1)}>−</button><button className="plus" onClick={()=>adjust('sa',1)}>+1</button></div><div className="courtControls right"><button aria-label="Retirer un point équipe droite" onClick={()=>adjust('sb',-1)}>−</button><button className="plus" onClick={()=>adjust('sb',1)}>+1</button></div><div className="courtBottom"><span>{cfg.mode==='time'?`${cfg.minutes} min`:`${cfg.points} points`}</span><button onClick={()=>saveMatch(m.id)}>✓ Terminer le match</button></div></>:<div className="courtEmpty">En attente d’une rencontre</div>}</div></article>})}</div><aside className="queuePanel"><div className="queueTitle"><small>PROCHAINES RENCONTRES</small><h3>Matchs en attente <span>{waiting.length}</span></h3><p>Un match disponible arrive automatiquement sur le terrain libéré.</p></div>{s.phase==='setup'?<div className="empty">Configure les poules pour commencer.</div>:waiting.length===0?<div className="empty">Aucun match en attente.</div>:<div className="queue">{waiting.map((m,i)=>{const occupied=new Set(s.matches.filter(x=>x.status==='playing').flatMap(x=>[x.a,x.b]));const ready=Boolean(m.a&&m.b&&!occupied.has(m.a)&&!occupied.has(m.b));return <div className={`queueItem ${ready?'queueReady':'queueWaiting'}`} key={m.id}><div className="queueMeta"><small>{m.phase==='pool'?`Poule ${String.fromCharCode(65+m.pool)}`:`Tour ${m.round+1}`} · Match {m.number||i+1}</small><strong>{ready?'Joueurs prêts':'En attente des joueurs'}</strong></div><div className="queueTeams"><span style={{borderLeftColor:teams[m.a]?.color||'#9ba7b6'}}>{teams[m.a]?.name||'À déterminer'}</span><b>VS</b><span style={{borderLeftColor:teams[m.b]?.color||'#9ba7b6'}}>{teams[m.b]?.name||'À déterminer'}</span></div><em>{ready?'En attente d’un terrain':'Joueurs indisponibles pour le moment'}</em></div>})}</div>}</aside></div></>}
{tab==='poules'&&<><section className="panel"><div className="sectionHead"><h3>Phase de poules</h3>{s.phase==='setup'&&['integral','pools'].includes(cfg.format)&&<button onClick={startPools}>▶ Générer et lancer les poules</button>}</div>{s.phase==='setup'&&<div className="settings"><label>Nombre de poules <input type="number" min="1" max={Math.max(1,Math.floor(s.teams.length/2))} value={s.pools} onChange={e=>setS(x=>({...x,pools:Math.max(1,Number(e.target.value)||1)}))}/></label><p>Répartition automatique modifiable avant le lancement. Chaque équipe rencontre les autres équipes de sa poule.</p></div>}{s.phase==='setup'&&['integral','pools'].includes(cfg.format)&&<div className="poolDraft"><div className="poolDraftHeader"><div><h4>Composition des poules</h4><p>Répartition automatique initiale. Déplace librement chaque équipe dans la poule de ton choix, puis lance les matchs.</p></div><button type="button" onClick={shufflePools}>↻ Nouveau tirage automatique</button></div><div className="poolDraftGrid">{Array.from({length:s.pools},(_,p)=>{const members=s.teams.filter((t,i)=>(Number.isInteger(s.poolDraft?.[t.id])&&s.poolDraft[t.id]<s.pools?s.poolDraft[t.id]:i%s.pools)===p);return <div className="poolDraftCard" key={p}><h4>Poule {String.fromCharCode(65+p)} <small>{members.length} équipes</small></h4>{members.map(t=><div className="poolDraftTeam" key={t.id}><i style={{background:t.color}}/><span>{t.name}</span><select aria-label={'Poule de '+t.name} value={p} onChange={e=>assignPool(t.id,Number(e.target.value))}>{Array.from({length:s.pools},(_,k)=><option value={k} key={k}>Poule {String.fromCharCode(65+k)}</option>)}</select></div>)}{members.length===0&&<p className="muted">Aucune équipe</p>}</div>})}</div><p className="muted">Chaque poule doit contenir au moins deux équipes pour démarrer. La composition est enregistrée avec le tournoi.</p></div>}{s.phase!=='setup'&&<div className="poolgrid">{poolGroups.map((group,p)=><div className="pool" key={p}><h4>POULE {String.fromCharCode(65+p)}</h4><table><thead><tr><th>Équipe</th><th>J</th><th>V</th><th>Diff.</th></tr></thead><tbody>{ranks(group,s.matches.filter(m=>m.phase==='pool')).map(t=><tr key={t.id}><td><i style={{background:t.color}}/>{t.name}</td><td>{t.played}</td><td>{t.w}</td><td>{t.pf-t.pa}</td></tr>)}</tbody></table></div>)}</div>}{s.phase==='pool'&&cfg.format==='integral'&&<div className="actions"><button onClick={beginFinal}>Créer le tableau final →</button><span>Tous les matchs des poules doivent être terminés.</span></div>}</section></>}
{tab==='tableau'&&<section className="panel"><div className="sectionHead"><h3>Tableau de classement intégral</h3>{s.phase==='pool'&&cfg.format==='integral'&&<button onClick={beginFinal}>Créer le tableau final →</button>}</div>{s.phase!=='final'?<div className="empty">Le tableau apparaît après le lancement d'une phase finale.</div>:<><p>Les gagnants et les perdants poursuivent chacun dans leur branche de classement. Les rencontres prêtes à jouer sont automatiquement envoyées sur les terrains.</p><div className="bracketLegend"><span>● Victoire → places supérieures</span><span>● Défaite → tableau de classement inférieur</span></div><div className="bracketSections">{s.double?<DoubleBracket matches={s.matches.filter(m=>m.phase==='final')} teams={teams}/>:<UnifiedBracket stages={bracketPlan} teams={teams} classificationPaths={classificationPaths}/>}</div><p className="bracketHint">← Faites glisser horizontalement pour consulter les tours suivants →</p><div className="finalCourtAction"><strong>🏸 Les matchs du tableau final se jouent sur les quatre terrains.</strong><button onClick={()=>setTab('terrains')}>Voir les terrains et saisir les scores →</button></div></>}</section>}
{tab==='classement'&&<section className="panel"><div className="sectionHead"><h3>🏆 Classement général</h3></div>{s.phase!=='final'&&cfg.format!=='league'&&cfg.format!=='pools'?<div className="empty">Le classement général sera disponible dès le lancement de la phase finale.</div>:<><div className="finalRankingHead"><h3>Classement général — 1 à {s.finalSize}</h3><span>{finalStandings.filter(x=>x.status==='done').length}/{s.finalSize} places attribuées</span></div><p className="muted">Chaque place est déterminée par un match de classement. Les places encore indécises sont indiquées ci-dessous.</p><div className="finalRanking">{(s.phase==='final'?finalStandings:ranks(s.teams,s.matches).map((team,i)=>({place:i+1,team,status:'done'}))).map(item=><div className={'finalRankRow '+(item.status==='done'?'rankKnown':'rankPending')} key={item.place}><strong className="rankNumber">{item.place}{item.place===1?' 🏆':''}</strong><i className="rankColor" style={{background:item.team?.color||'#aeb9c8'}}/><span>{item.team?.name||'À déterminer'}</span>{item.status==='done'&&<b>Classé</b>}</div>)}</div>{finalFinished&&<div className="finalComplete">🏆 Tournoi terminé : toutes les équipes sont classées !</div>}</>}</section>}
 <footer>Badminton Manager · Données sauvegardées sur cet appareil · Règles personnalisables · {cfg.courts} terrains</footer></main></div>}
createRoot(document.getElementById('root')).render(<App/>);
