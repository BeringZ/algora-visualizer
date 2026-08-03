(function(){
'use strict';
const baseBuild=window.buildTrace;
const baseCode=window.getCodeBundle;
const clone=x=>JSON.parse(JSON.stringify(x));
const nums=(raw,f=[12,24,36,48,60])=>{const a=String(raw||'').split(/[，,\s]+/).map(Number).filter(Number.isFinite).slice(0,10);return a.length?a:f.slice();};
const F=(visual,message,line=0,vars={})=>({visual:clone(visual),message,line,vars});
const op=(id,label)=>({id,label});
window.getOperations=function(m){
  if(m.type==='linked') return [op('create','创建'),op('insert','插入'),op('delete','删除'),op('access','访问'),op('search','查找'),op('traverse','遍历'),op('reverse','反转')];
  if(m.id==='sequence-list'||m.id==='static-list') return [op('create','创建'),op('insert','插入'),op('delete','删除'),op('access','访问'),op('update','修改'),op('search','查找'),op('traverse','遍历')];
  if(m.type==='stack'&&!['bracket-match','expression-eval'].includes(m.id)) return [op('create','创建'),op('push','入栈'),op('pop','出栈'),op('peek','访问栈顶'),op('traverse','遍历'),op('clear','清空')];
  if(m.type==='queue'&&!['level-order'].includes(m.id)) return m.id==='deque'?[op('create','创建'),op('push-front','队头插入'),op('push-back','队尾插入'),op('pop-front','队头删除'),op('pop-back','队尾删除'),op('access','访问'),op('traverse','遍历')]:[op('create','创建'),op('enqueue','入队'),op('dequeue','出队'),op('front','访问队头'),op('traverse','遍历'),op('clear','清空')];
  if(m.type==='matrix') return [op('create','创建'),op('access','访问'),op('update','修改'),op('traverse','遍历'),op('compress','压缩存储')];
  if(m.type==='string') return [op('create','创建'),op('access','访问字符'),op('traverse','遍历'),op('match','模式匹配')];
  if(m.type==='tree'||m.type==='btree'||m.id==='level-order') return [op('create','创建'),op('insert','插入'),op('delete','删除'),op('search','查找'),op('preorder','先序'),op('inorder','中序'),op('postorder','后序'),op('level','层序')];
  if(m.type==='graph') return [op('create','创建'),op('add-vertex','添加顶点'),op('add-edge','添加边'),op('delete-edge','删除边'),op('access','访问邻接点'),op('bfs-op','BFS遍历'),op('dfs-op','DFS遍历'),op('algorithm','运行算法')];
  if(m.type==='hash') return [op('create','创建'),op('insert','插入'),op('delete','删除'),op('search','查找'),op('traverse','遍历')];
  if(m.category==='sort') return [op('create','创建数据'),op('algorithm','排序演示'),op('access','访问'),op('traverse','遍历')];
  if(m.category==='search') return [op('create','创建数据'),op('algorithm','查找演示'),op('access','访问'),op('traverse','遍历')];
  return [op('algorithm','算法演示'),op('create','初始化'),op('traverse','逐步遍历')];
};
function arrayTrace(raw,action){
 const a=nums(raw), cap=Math.max(10,a.length+2), pos=Math.min(2,Math.max(0,a.length-1)), val=99, frames=[];
 const V=(values,active=[],extra={})=>({type:'array',values,active,pointers:{length:values.filter(x=>x!==null).length,capacity:cap,...(extra.pointers||{})},...extra});
 if(action==='create'){frames.push(F(V(Array(cap).fill(null),[],{pointers:{length:0,capacity:cap}}),'申请连续存储空间，length 初始化为 0',0,{length:0}));let w=Array(cap).fill(null);a.forEach((x,i)=>{w[i]=x;frames.push(F(V(w,[i],{inserted:[i]}),`写入 data[${i}] = ${x}`,1,{i,value:x,length:i+1}));});frames.push(F(V(w,[],{success:true}),'顺序表创建完成',2,{length:a.length}));}
 else if(action==='insert') return baseBuild({...window.ALGORA_MODULES.find(x=>x.demo==='sequence')},raw);
 else if(action==='delete'){let w=a.slice();frames.push(F(V(w,[pos],{pointers:{pos}}),`定位待删除位置 ${pos}`,0,{pos,removed:w[pos]}));for(let i=pos;i<w.length-1;i++){w[i]=w[i+1];frames.push(F(V(w,[i,i+1],{moved:[i],pointers:{i,pos}}),`data[${i}] ← data[${i+1}]`,1,{i}));}w.pop();frames.push(F(V(w,[],{success:true}),'表长减 1，删除完成',2,{length:w.length}));}
 else if(action==='access'){frames.push(F(V(a,[],{pointers:{pos}}),'检查访问下标是否合法',0,{pos,length:a.length}));frames.push(F(V(a,[pos],{found:[pos],pointers:{pos}}),`直接读取 data[${pos}] = ${a[pos]}`,1,{result:a[pos]}));}
 else if(action==='update'){let w=a.slice();frames.push(F(V(w,[pos],{pointers:{pos}}),`定位 data[${pos}]`,0,{old:w[pos]}));w[pos]=val;frames.push(F(V(w,[pos],{inserted:[pos],pointers:{pos}}),`将 data[${pos}] 修改为 ${val}`,1,{value:val}));}
 else {a.forEach((x,i)=>frames.push(F(V(a,[i],action==='search'&&x===a[pos]?{found:[i],pointers:{i}}:{pointers:{i}}),action==='search'?`比较 data[${i}] 与目标 ${a[pos]}`:`访问 data[${i}] = ${x}`,action==='search'?1:0,{i,value:x,target:action==='search'?a[pos]:undefined})));if(action==='search')frames.push(F(V(a,[pos],{found:[pos],success:true,pointers:{pos}}),`找到目标，下标为 ${pos}`,2,{result:pos}));}
 return {frames};
}
function linkedTrace(raw,action,m){
 const a=nums(raw,[18,27,35,46]).slice(0,6), head=m.demo.includes('head'), doubly=m.demo.includes('doubly'), circular=m.demo.includes('circular');
 const base=head?['HEAD',...a]:a, flags={type:'linked',head,doubly,circular}, frames=[], pos=Math.min(head?2:1,base.length-1), val=99;
 const V=(values,active=[],extra={})=>({...flags,values,active,...extra});
 if(action==='create'){frames.push(F(V(head?['HEAD']:[]),'初始化头指针与空链表',0));let w=head?['HEAD']:[];a.forEach((x,i)=>{w=[...w,x];frames.push(F(V(w,[w.length-1],{inserted:[w.length-1]}),`创建结点 ${x} 并连接到链尾`,1,{value:x,length:i+1}));});frames.push(F(V(w,[],{success:true}),'链表创建完成',2));}
 else if(action==='insert') return baseBuild(m,raw);
 else if(action==='delete'){let w=base.slice();frames.push(F(V(w,[pos]),`定位待删除结点 ${w[pos]}`,0,{pos}));frames.push(F(V(w,[Math.max(0,pos-1),pos]),'前驱指针绕过该结点并连接其后继',1));w.splice(pos,1);frames.push(F(V(w,[],{success:true}),'释放结点，删除完成',2));}
 else if(action==='reverse'){let w=base.slice();const start=head?1:0;frames.push(F(V(w,[start]),'设置 prev=null，current 指向首元结点',0));for(let i=start;i<w.length;i++)frames.push(F(V(w,[i]),`反转结点 ${w[i]} 的 next 指针`,1,{current:w[i],prev:i>start?w[i-1]:null}));const prefix=head?['HEAD']:[];w=[...prefix,...w.slice(start).reverse()];frames.push(F(V(w,[],{success:true}),'链表反转完成',2));}
 else {for(let i=head?1:0;i<base.length;i++){frames.push(F(V(base,[i],action==='search'&&i===pos?{found:[i]}:{}),action==='access'?`沿 next 指针访问第 ${i-(head?1:0)} 个结点`:action==='search'?`比较结点值 ${base[i]} 与目标 ${base[pos]}`:`访问结点 ${base[i]}`,1,{p:i,value:base[i]}));if(action==='access'&&i===pos)break;}if(action==='search')frames.push(F(V(base,[pos],{found:[pos],success:true}),'找到目标结点',2,{result:pos}));}
 return {frames};
}
function linearTrace(raw,action,type,linked=false){
 const a=nums(raw,[14,27,39]), isStack=type==='stack', frames=[];
 const V=(values,active=[],extra={})=>{
   if(linked){
     // 链栈/链队列：结点 + 指针视图（文档工作流 B：不再复用数组方块视图）
     const ptrs=isStack?{topIndex:values.length-1}:{frontIndex:0,rearIndex:Math.max(0,values.length-1)};
     return {type:'linked',values,active,linkedStack:isStack,linkedQueue:!isStack,...ptrs,...extra};
   }
   return {type,values,active,...extra};
 };
 if(action==='create'){frames.push(F(V([]),'初始化空结构',0,{size:0}));let w=[];a.forEach((x,i)=>{w=[...w,x];frames.push(F(V(w,[w.length-1],{inserted:[w.length-1]}),`加入元素 ${x}`,1,{size:i+1}));});}
 else if(['push','enqueue','push-front','push-back'].includes(action)){let w=a.slice();const front=action==='push-front';w=front?[88,...w]:[...w,88];frames.push(F(V(a),'检查容量与边界',0));frames.push(F(V(w,[front?0:w.length-1],{inserted:[front?0:w.length-1]}),`${front?'队头':'末端'}加入 88`,1,{size:w.length}));}
 else if(['pop','dequeue','pop-front','pop-back'].includes(action)){const back=action==='pop'||action==='pop-back';const idx=back?a.length-1:0;frames.push(F(V(a,[idx]),`读取将被删除的元素 ${a[idx]}`,0,{result:a[idx]}));let w=a.slice();back?w.pop():w.shift();frames.push(F(V(w,[],{success:true}),'移动边界指针，删除完成',1,{size:w.length}));}
 else if(action==='clear'){let w=a.slice();frames.push(F(V(w),'开始清空结构',0));while(w.length){const idx=isStack?w.length-1:0;w=isStack?w.slice(0,-1):w.slice(1);frames.push(F(V(w),`删除一个元素，剩余 ${w.length} 个`,1,{size:w.length}));}}
 else {const idx=(action==='peek'||action==='pop')?a.length-1:0;if(['peek','front','access'].includes(action))frames.push(F(V(a,[idx],{found:[idx]}),`访问元素 ${a[idx]}`,0,{result:a[idx]}));else a.forEach((x,i)=>frames.push(F(V(a,[i]),`遍历元素 ${x}`,1,{i,value:x})));}
 return {frames};
}
function matrixOp(raw,action){const a=nums(raw,[1,2,3,4,5,6,7,8,9]);const n=3,m=[a.slice(0,3),a.slice(3,6),a.slice(6,9)];while(m.length<3)m.push([0,0,0]);m.forEach(r=>{while(r.length<3)r.push(0)});const frames=[];if(action==='create'){frames.push(F({type:'matrix',matrix:Array.from({length:n},()=>Array(n).fill(0)),active:[]},'申请 3×3 矩阵空间',0));m.forEach((r,i)=>r.forEach((x,j)=>frames.push(F({type:'matrix',matrix:m,active:[[i,j]]},`写入 a[${i}][${j}] = ${x}`,1,{i,j,value:x}))));}else if(action==='update'){const w=clone(m);frames.push(F({type:'matrix',matrix:w,active:[[1,1]]},'定位 a[1][1]',0));w[1][1]=99;frames.push(F({type:'matrix',matrix:w,active:[[1,1]]},'修改为 99',1,{i:1,j:1,value:99}));}else if(action==='compress'){const storage=[];m.forEach((r,i)=>r.forEach((x,j)=>{if(x!==0){storage.push({r:i,col:j,value:x});frames.push(F({type:'matrix',matrix:m,active:[[i,j]],storage},`保存非零元素 (${i},${j},${x})`,1,{count:storage.length}));}}));}else {m.forEach((r,i)=>r.forEach((x,j)=>frames.push(F({type:'matrix',matrix:m,active:[[i,j]]},action==='access'&&i===1&&j===1?`访问 a[1][1] = ${x}`:`遍历 a[${i}][${j}]`,1,{i,j,value:x}))));if(action==='access')return {frames:frames.filter(f=>f.vars.i===1&&f.vars.j===1)};}return {frames};}
function treeOp(action){const nodes=[{id:'40',x:50,y:10,parent:null},{id:'20',x:27,y:36,parent:'40'},{id:'60',x:73,y:36,parent:'40'},{id:'10',x:14,y:68,parent:'20'},{id:'30',x:39,y:68,parent:'20'},{id:'50',x:62,y:68,parent:'60'},{id:'70',x:86,y:68,parent:'60'}];const orders={preorder:['40','20','10','30','60','50','70'],inorder:['10','20','30','40','50','60','70'],postorder:['10','30','20','50','70','60','40'],level:['40','20','60','10','30','50','70']};const frames=[];if(action==='create'||action==='insert'){let built=[];nodes.forEach((n,i)=>{built.push(n);frames.push(F({type:'tree',nodes:clone(built),active:[n.id],visited:[]},`${i?'插入':'创建根'}结点 ${n.id}`,i?1:0,{node:n.id}));});}else if(action==='delete'){frames.push(F({type:'tree',nodes,active:['20'],visited:[]},'定位待删除结点 20',0));const left=nodes.filter(n=>n.id!=='20'&&n.id!=='10'&&n.id!=='30');left.push({...nodes.find(n=>n.id==='30'),parent:'40'},{...nodes.find(n=>n.id==='10'),parent:'30'});frames.push(F({type:'tree',nodes:left,active:['30'],visited:[]},'用中序后继 30 替代并重新连接子树',1));}else {const order=orders[action]||orders.preorder;order.forEach((id,i)=>frames.push(F({type:'tree',nodes,active:[id],visited:order.slice(0,i+1),queue:action==='level'?order.slice(i+1,i+4):[]},action==='search'?`比较目标与结点 ${id}`:`访问结点 ${id}`,1,{node:id})));}return {frames};}
function graphOp(action,m){if(action==='algorithm')return baseBuild(m,'');const g={type:'graph',directed:false,nodes:[{id:'A',x:15,y:50},{id:'B',x:38,y:20},{id:'C',x:65,y:25},{id:'D',x:83,y:62},{id:'E',x:45,y:80}],edges:[['A','B',2],['A','E',4],['B','C',3],['B','E',1],['C','D',2],['D','E',5]]};const frames=[];if(action==='create'){frames.push(F({...g,nodes:[],edges:[]},'初始化空图',0));g.nodes.forEach((n,i)=>frames.push(F({...g,nodes:g.nodes.slice(0,i+1),edges:[] ,activeNodes:[n.id]},`添加顶点 ${n.id}`,1)));g.edges.forEach((e,i)=>frames.push(F({...g,edges:g.edges.slice(0,i+1),activeEdges:[e]},`添加边 ${e[0]}-${e[1]}`,2)));}else if(action==='add-vertex'){frames.push(F(g,'当前图结构',0));frames.push(F({...g,nodes:[...g.nodes,{id:'F',x:93,y:30}],activeNodes:['F']},'添加新顶点 F',1));}else if(action==='add-edge'){frames.push(F(g,'选择顶点 A 与 C',0,{u:'A',v:'C'}));frames.push(F({...g,edges:[...g.edges,['A','C',6]],activeEdges:[['A','C',6]]},'写入边 A-C，权值 6',1));}else if(action==='delete-edge'){frames.push(F({...g,activeEdges:[g.edges[2]]},'定位边 B-C',0));frames.push(F({...g,edges:g.edges.filter((_,i)=>i!==2)},'从邻接结构中删除该边',1));}else {const order=action==='dfs-op'?['A','B','C','D','E']:['A','B','E','C','D'];order.forEach((id,i)=>frames.push(F({...g,activeNodes:[id],visited:order.slice(0,i+1),frontier:order.slice(i+1,i+3)},action==='access'?`访问 ${id} 的邻接点`: `遍历顶点 ${id}`,1,{vertex:id})));}return {frames};}
function hashOp(raw,action,m){if(action==='insert'&&m.demo.startsWith('hash'))return baseBuild(m,raw);const a=nums(raw,[12,25,38,17]), buckets=Array.from({length:7},()=>[]);a.forEach(x=>buckets[x%7].push(x));const frames=[];if(action==='create'){frames.push(F({type:'hash',buckets:Array.from({length:7},()=>[]),active:-1,chaining:true},'创建 7 个空桶',0));const buildBuckets=Array.from({length:7},()=>[]);a.forEach(x=>{const k=x%7;buildBuckets[k].push(x);frames.push(F({type:'hash',buckets:clone(buildBuckets),active:k,chaining:true},`计算 ${x} mod 7 = ${k}，放入桶 ${k}`,1,{key:x,index:k}));});}else if(action==='delete'){const x=a[1],k=x%7;frames.push(F({type:'hash',buckets,active:k,chaining:true},`定位桶 ${k}`,0));const w=clone(buckets);w[k]=w[k].filter(v=>v!==x);frames.push(F({type:'hash',buckets:w,active:k,chaining:true},`删除关键字 ${x}`,1));}else {const target=a[2],k=target%7;frames.push(F({type:'hash',buckets,active:k,chaining:true},action==='search'?`计算目标桶 ${k}`:'按桶顺序遍历',0));(action==='search'?[target]:a).forEach(x=>frames.push(F({type:'hash',buckets,active:x%7,chaining:true},action==='search'?`在桶 ${x%7} 中找到 ${x}`:`访问关键字 ${x}`,1,{key:x})));}return {frames};}
function genericOp(m,raw,action){
 if(m.type==='linked')return linkedTrace(raw,action,m);
 if(m.id==='sequence-list'||m.id==='static-list')return arrayTrace(raw,action);
 if(m.type==='stack')return linearTrace(raw,action,'stack',m.id.startsWith('linked-'));
 if(m.type==='queue')return linearTrace(raw,action,'queue',m.id.startsWith('linked-'));
 if(m.type==='matrix')return matrixOp(raw,action);
 if(m.type==='tree'||m.type==='btree'||m.id==='level-order')return treeOp(action);
 if(m.type==='graph')return graphOp(action,m);
 if(m.type==='hash')return hashOp(raw,action,m);
 if(action==='algorithm'||action==='match')return baseBuild(m,raw);
 return arrayTrace(raw,action==='create'?'create':action==='access'?'access':'traverse');
}
window.buildTrace=function(m,raw,action){if(!action||action==='algorithm'||action==='match')return baseBuild(m,raw);const t=genericOp(m,raw,action);if(!t.frames.length)t.frames=[F({type:'array',values:nums(raw),active:[]},'操作完成',0)];return t;};
window.getCodeBundle=function(m,trace,action){if(!action||action==='algorithm'||action==='match')return baseCode(m,trace);return window.getOperationCode(m,action);};
})();
