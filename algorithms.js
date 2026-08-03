(function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const frame = (visual, message, line = 0, vars = {}) => ({ visual: clone(visual), message, line, vars });
  const safeNums = (raw, fallback = [42, 17, 8, 33, 21, 5, 29]) => {
    const values = String(raw || '').split(/[，,\s]+/).map(Number).filter(Number.isFinite).slice(0, 12);
    return values.length ? values : fallback.slice();
  };
  const basicGraph = () => ({
    directed: false,
    nodes: [
      { id:'A', x:14, y:50 }, { id:'B', x:34, y:18 }, { id:'C', x:58, y:22 },
      { id:'D', x:84, y:47 }, { id:'E', x:58, y:78 }, { id:'F', x:30, y:82 }
    ],
    edges: [
      ['A','B',4], ['A','F',2], ['B','C',3], ['B','F',1], ['C','D',2],
      ['C','E',4], ['D','E',1], ['E','F',5], ['B','E',6]
    ]
  });
  const dagGraph = () => ({
    directed: true,
    nodes: [
      { id:'A', x:10, y:50 }, { id:'B', x:32, y:20 }, { id:'C', x:32, y:78 },
      { id:'D', x:58, y:18 }, { id:'E', x:58, y:72 }, { id:'F', x:86, y:46 }
    ],
    edges: [['A','B',3],['A','C',2],['B','D',2],['B','E',3],['C','E',4],['D','F',3],['E','F',2]]
  });
  const treeNodes = () => [
    { id:'40', x:50, y:10, parent:null },
    { id:'20', x:27, y:36, parent:'40' }, { id:'60', x:73, y:36, parent:'40' },
    { id:'10', x:14, y:68, parent:'20' }, { id:'30', x:39, y:68, parent:'20' },
    { id:'50', x:62, y:68, parent:'60' }, { id:'70', x:86, y:68, parent:'60' }
  ];
  // 帧语义字段（计划书工作流 A：phase/mutation/invariantChecks/cost）
  const meta = (f, m) => { f._meta = m; return f; };
  // 用 validateLinkedList 检测「错误顺序」演示后的结构（自环/断链）
  function runLinkedListValidator(values, selfIdx, headIdx) {
    const fail = { ok: false, violations: [{ type: 'cycle', nodeId: String(values[selfIdx]), detail: `检测到环：新结点 ${values[selfIdx]} 的 next 指向自身（先覆盖前驱指针所致）` }] };
    if (typeof window === 'undefined' || !window.AlgoraValidators || !window.AlgoraValidators.validateLinkedList) return fail;
    const nodes = {};
    values.forEach((v, i) => { nodes['n' + i] = { id: 'n' + i, value: v, next: i === values.length - 1 ? null : 'n' + (i + 1) }; });
    nodes['n' + selfIdx].next = 'n' + selfIdx; // 错误顺序：指向自己
    return window.AlgoraValidators.validateLinkedList({ head: 'n' + headIdx, nodes });
  }

  function sequenceTrace(raw) {
    const arr = safeNums(raw, [12, 24, 31, 46, 58]).slice(0, 7);
    const insertPos = Math.min(2, arr.length);
    const value = 99;
    const code = [
      'boolean insert(List L, int pos, int value) {',
      '  if (pos < 0 || pos > L.length) return false;',
      '  if (L.length == L.capacity) expand(L);',
      '  for (int i = L.length; i > pos; i--)',
      '    L.data[i] = L.data[i - 1];',
      '  L.data[pos] = value;',
      '  L.length++;',
      '  return true;',
      '}'
    ];
    const frames = [];
    frames.push(frame({type:'array', values:arr, active:[], pointers:{length:arr.length, capacity:Math.max(8,arr.length+2)}}, `初始顺序表长度为 ${arr.length}`, 0));
    frames.push(frame({type:'array', values:arr, active:[insertPos], pointers:{pos:insertPos}}, `检查插入位置 pos=${insertPos}`, 1, {pos:insertPos,value}));
    const work = arr.slice(); work.push(null);
    frames.push(frame({type:'array', values:work, active:[work.length-1], pointers:{length:arr.length, capacity:work.length+1}}, '为新元素预留一个空位', 2));
    for (let i = arr.length; i > insertPos; i--) {
      work[i] = work[i-1];
      frames.push(frame({type:'array', values:work, active:[i-1,i], moved:[i]}, `将索引 ${i-1} 的元素向后移动到 ${i}`, 4, {i}));
    }
    work[insertPos] = value;
    frames.push(frame({type:'array', values:work, active:[insertPos], inserted:[insertPos]}, `在索引 ${insertPos} 写入 ${value}`, 5, {pos:insertPos,value}));
    frames.push(frame({type:'array', values:work, active:[], success:true, pointers:{length:work.length}}, '插入完成，表长加 1', 6));
    return { code, frames };
  }

  function linkedTrace(raw, mode='single') {
    const values = safeNums(raw, [18, 27, 35, 46]).slice(0, 6);
    const doubly = mode.includes('doubly');
    const circular = mode.includes('circular');
    const head = mode.includes('head');
    const code = [
      'Node p = locate(list, pos - 1);',
      'Node s = new Node(value);',
      's.next = p.next;',
      doubly ? 's.prev = p;' : '// 单链表无需维护 prev',
      doubly ? 'if (p.next != null) p.next.prev = s;' : '// 更新后继关系',
      'p.next = s;',
      'list.length++;'
    ];
    const base = head ? ['HEAD', ...values] : values.slice();
    const flags = { head, doubly, circular };
    const frames = [frame({type:'linked', values:base, active:[0], ...flags}, '从链表入口开始定位插入位置', 0)];
    const pos = Math.min(head ? 2 : 1, base.length-1);
    frames.push(frame({type:'linked', values:base, active:[pos], ...flags}, `找到前驱结点 ${base[pos]}`, 0, {pos}));
    frames.push(frame({type:'linked', values:base, active:[pos], floating:99, ...flags}, '创建值为 99 的新结点', 1));
    frames.push(frame({type:'linked', values:base, active:[pos,pos+1], floating:99, connect:'successor', ...flags}, '新结点先指向原后继，避免链表断裂', 2));
    if (doubly) frames.push(frame({type:'linked', values:base, active:[pos,pos+1], floating:99, connect:'prev', ...flags}, '同步维护 prev 指针', 3));
    const next = base.slice(); next.splice(pos+1,0,99);
    frames.push(frame({type:'linked', values:next, active:[pos+1], inserted:[pos+1], ...flags}, '前驱结点改为指向新结点', 5));
    frames.push(frame({type:'linked', values:next, active:[], success:true, ...flags}, '插入完成', 6));

    /* —— 错误顺序演示（计划书工作流 B：至少提供一个会破坏结构的错误代码，允许用户诊断）——
       正确顺序：s.next = p.next; p.next = s;（先挂后继，再改前驱）
       错误顺序：p.next = s; s.next = p.next;（先覆盖前驱 → s.next 指向自己 → 自环） */
    const broken = base.slice(); broken.splice(pos + 1, 0, 99); // 新结点插入位置
    frames.push(meta(frame({ type: 'linked', values: base, active: [pos], floating: 99, errorOrder: true, ...flags },
      '⚠️ 错误顺序演示：插入时若「先让前驱指向新结点」，会发生什么？', 0), {
      phase: 'locate', condition: '错误顺序：p.next = s; s.next = p.next;',
      mutation: { type: 'write', targets: [String(base[pos])] },
      invariantChecks: ['linked-next'], cost: { reads: 1, writes: 1 }
    }));
    frames.push(meta(frame({ type: 'linked', values: broken, active: [pos, pos + 1], selfLoop: pos + 1, errorOrder: true, ...flags },
      `前驱 ${base[pos]} 先指向新结点 99，原后继 ${base[pos + 1]} 的引用被覆盖丢失`, 0), {
      phase: 'mutate', condition: 'p.next = s（先覆盖前驱指针）',
      mutation: { type: 'write', targets: [String(base[pos]), '99'] },
      invariantChecks: ['linked-next'], cost: { reads: 1, writes: 1 }
    }));
    const lres = runLinkedListValidator(broken, pos + 1, head ? 0 : 0);
    frames.push(meta(frame({ type: 'linked', values: broken, active: [pos + 1], selfLoop: pos + 1, errorOrder: true, ...flags },
      '再执行 s.next = p.next：此时 p.next 已是 s，新结点指向自身 → 链表成环。结构验证器立即捕获！', 1), {
      phase: 'verify', condition: 's.next = p.next（p.next 已被覆盖为 s）',
      mutation: { type: 'write', targets: ['99'] },
      invariantChecks: ['linked-next'], invariantResult: lres,
      cost: { reads: 1, writes: 1 }
    }));
    return { code, frames };
  }

  function staticListTrace(raw) {
    const values = safeNums(raw,[32,18,47,25]).slice(0,5);
    const slots = [
      {index:0,value:values[0],next:3},{index:1,value:null,next:-1},{index:2,value:values[2],next:4},
      {index:3,value:values[1],next:2},{index:4,value:values[3],next:-1},{index:5,value:null,next:1}
    ];
    const code = ['int p = head;', 'while (cursor[p].next != -1) {', '  visit(cursor[p].data);', '  p = cursor[p].next;', '}'];
    const order=[0,3,2,4];
    const frames=[frame({type:'static-list',slots,active:[0],order:[]},'数组下标充当“指针”',0)];
    order.forEach((idx,i)=>frames.push(frame({type:'static-list',slots,active:[idx],order:order.slice(0,i+1)},`访问下标 ${idx}，下一个游标为 ${slots[idx].next}`,3,{p:idx})));
    return {code,frames};
  }

  function stackTrace(raw, linked=false) {
    const values=safeNums(raw,[14,27,39]).slice(0,5);
    const code=['void push(Stack S, int x) {','  S.data[S.top++] = x;','}','int pop(Stack S) {','  return S.data[--S.top];','}'];
    const frames=[frame({type:'stack',values,active:[values.length-1],linked},'栈顶位于最后一个元素',0,{top:values.length})];
    const pushed=[...values,88];
    frames.push(frame({type:'stack',values:pushed,active:[pushed.length-1],inserted:[pushed.length-1],linked},'执行 push(88)：元素进入栈顶',1,{top:pushed.length}));
    frames.push(frame({type:'stack',values:pushed,active:[pushed.length-1],linked},'执行 pop()：读取栈顶元素',4,{top:pushed.length}));
    frames.push(frame({type:'stack',values,active:[],linked},'88 出栈，top 指针回退',4,{top:values.length,result:88}));
    return {code,frames};
  }

  function queueTrace(raw, circular=false, deque=false) {
    const values=safeNums(raw,[11,23,34,48]).slice(0,6);
    const code = deque ? [
      'deque.addLast(77);','deque.addFirst(6);','int x = deque.removeLast();','int y = deque.removeFirst();'
    ] : [
      'queue[rear] = value;','rear = (rear + 1) % capacity;','value = queue[front];','front = (front + 1) % capacity;'
    ];
    const frames=[frame({type:'queue',values,active:[0,values.length-1],circular,deque},'front 指向队头，rear 指向队尾之后',0,{front:0,rear:values.length})];
    const enqueued=[...values,77];
    frames.push(frame({type:'queue',values:enqueued,active:[enqueued.length-1],inserted:[enqueued.length-1],circular,deque},deque?'从队尾加入 77':'77 从队尾入队',0,{front:0,rear:enqueued.length}));
    if(deque){
      const both=[6,...enqueued];
      frames.push(frame({type:'queue',values:both,active:[0],inserted:[0],circular,deque},'双端队列允许从队头加入 6',1));
      both.pop();
      frames.push(frame({type:'queue',values:both,active:[both.length-1],circular,deque},'从队尾删除 77',2));
    } else {
      frames.push(frame({type:'queue',values:enqueued,active:[0],circular,deque},`读取队头元素 ${enqueued[0]}`,2,{front:0}));
      const after=enqueued.slice(1);
      frames.push(frame({type:'queue',values:after,active:[0],circular,deque},'队头元素出队，front 前移',3,{front:1,rear:enqueued.length}));
    }
    return {code,frames};
  }

  function bracketTrace() {
    const text='([{}])'; const code=['for (char ch : text) {','  if (isLeft(ch)) stack.push(ch);','  else if (stack.empty()) return false;','  else if (!match(stack.pop(), ch)) return false;','}','return stack.empty();'];
    const frames=[]; const stack=[];
    frames.push(frame({type:'bracket',text,index:-1,stack:[]},'扫描表达式中的每一个括号',0));
    [...text].forEach((ch,i)=>{
      if('([{'.includes(ch)){stack.push(ch);frames.push(frame({type:'bracket',text,index:i,stack},`遇到左括号 ${ch}，入栈`,1));}
      else {const left=stack.pop();frames.push(frame({type:'bracket',text,index:i,stack,match:[left,ch]},`${left} 与 ${ch} 匹配，左括号出栈`,3));}
    });
    frames.push(frame({type:'bracket',text,index:text.length,stack,success:true},'扫描结束且栈为空，括号匹配成功',5));
    return {code,frames};
  }

  function expressionTrace() {
    const expr='3 + 4 × 2'; const code=['scan(token);','if (isNumber(token)) numbers.push(token);','while (priority(top) >= priority(token)) reduce();','operators.push(token);','while (!operators.empty()) reduce();'];
    const frames=[
      frame({type:'expression',expr,index:0,numbers:[3],operators:[]},'读取数字 3，压入操作数栈',1),
      frame({type:'expression',expr,index:2,numbers:[3],operators:['+']},'读取 +，压入运算符栈',3),
      frame({type:'expression',expr,index:4,numbers:[3,4],operators:['+']},'读取数字 4',1),
      frame({type:'expression',expr,index:6,numbers:[3,4],operators:['+','×']},'× 的优先级更高，直接入栈',3),
      frame({type:'expression',expr,index:8,numbers:[3,4,2],operators:['+','×']},'读取数字 2',1),
      frame({type:'expression',expr,index:expr.length,numbers:[3,8],operators:['+']},'计算 4 × 2 = 8',4),
      frame({type:'expression',expr,index:expr.length,numbers:[11],operators:[],success:true},'计算 3 + 8 = 11',4,{result:11})
    ]; return {code,frames};
  }

  function matrixTrace(kind) {
    const base=[
      [1,2,3,4],[2,5,6,7],[3,6,8,9],[4,7,9,10]
    ];
    let matrix=base, code=['k = i * n + j;','value = storage[k];'], message='二维数组按行优先映射到一维存储空间';
    if(kind==='triangular') { matrix=[[1,0,0,0],[2,3,0,0],[4,5,6,0],[7,8,9,10]]; code=['if (i >= j) k = i*(i+1)/2 + j;','else return constant;']; message='下三角区域连续压缩存储'; }
    if(kind==='tridiagonal') { matrix=[[1,2,0,0],[3,4,5,0],[0,6,7,8],[0,0,9,10]]; code=['if (abs(i-j) <= 1) k = 2*i + j;','else return 0;']; message='三对角矩阵仅保存 3n-2 个元素'; }
    if(kind==='sparse') { matrix=[[0,8,0,0],[0,0,0,6],[4,0,0,0],[0,0,9,0]]; code=['for each a[i][j] != 0','  triples.add(i, j, a[i][j]);']; message='扫描非零元素并生成三元组'; }
    const frames=[frame({type:'matrix',matrix,active:[],kind},message,0)];
    const coords=kind==='sparse'?[[0,1],[1,3],[2,0],[3,2]]:[[0,0],[1,0],[1,1],[2,1],[3,2]];
    coords.forEach((c,i)=>frames.push(frame({type:'matrix',matrix,active:[c],kind,storage:coords.slice(0,i+1).map(([r,col])=>({r,col,value:matrix[r][col]}))},`访问 a[${c[0]}][${c[1]}] = ${matrix[c[0]][c[1]]}`,kind==='sparse'?1:0,{i:c[0],j:c[1]})));
    return {code,frames};
  }

  function stringTrace(kmp=false) {
    const text='ABABABC'; const pattern='ABABC';
    const code=kmp?[
      'int i = 0, j = 0;','while (i < n && j < m) {','  if (j == -1 || text[i] == pattern[j]) { i++; j++; }','  else j = next[j];','}','return j == m ? i - j : -1;'
    ]:[
      'for (int i = 0; i <= n - m; i++) {','  int j = 0;','  while (j < m && text[i+j] == pattern[j]) j++;','  if (j == m) return i;','}','return -1;'
    ];
    const frames=[];
    if(!kmp){
      [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[2,1],[2,2],[2,3],[2,4]].forEach(([offset,j])=>{
        const ok=text[offset+j]===pattern[j];
        frames.push(frame({type:'string',text,pattern,offset,textIndex:offset+j,patternIndex:j,ok},ok?`字符 ${text[offset+j]} 匹配`:`失配，模式串右移`,ok?2:0,{i:offset,j}));
      });
    } else {
      const next=[-1,0,0,1,2]; let i=0,j=0;
      frames.push(frame({type:'string',text,pattern,offset:0,textIndex:0,patternIndex:0,next},`next = [${next.join(', ')}]`,0));
      while(i<text.length&&j<pattern.length){
        if(j===-1||text[i]===pattern[j]){frames.push(frame({type:'string',text,pattern,offset:i-j,textIndex:i,patternIndex:j,next,ok:true},j===-1?'按 next 规则同步前进':`${text[i]} 匹配`,2,{i,j}));i++;j++;}
        else {frames.push(frame({type:'string',text,pattern,offset:i-j,textIndex:i,patternIndex:j,next,ok:false},`失配：j 从 ${j} 跳到 next[${j}]=${next[j]}`,3,{i,j}));j=next[j];}
      }
      frames.push(frame({type:'string',text,pattern,offset:i-j,textIndex:i-1,patternIndex:j-1,next,success:true},`匹配成功，起始位置 ${i-j}`,5));
    }
    return {code,frames};
  }

  function treeTrace(kind='binary') {
    const nodes=treeNodes();
    let order=['40','20','10','30','60','50','70'];
    let code=['void preorder(Node root) {','  if (root == null) return;','  visit(root);','  preorder(root.left);','  preorder(root.right);','}'];
    let title='先序遍历：根 → 左 → 右';
    if(kind==='level'){ order=['40','20','60','10','30','50','70']; code=['queue.offer(root);','while (!queue.empty()) {','  Node p = queue.poll();','  visit(p);','  if (p.left != null) queue.offer(p.left);','  if (p.right != null) queue.offer(p.right);','}']; title='层次遍历使用队列保存下一层结点'; }
    if(kind==='threaded'){ order=['10','20','30','40','50','60','70']; code=['thread(root);','if (node.left == null) { node.left = predecessor; node.ltag = 1; }','if (predecessor.right == null) { predecessor.right = node; predecessor.rtag = 1; }']; title='中序线索化：空左指针指向前驱，空右指针指向后继'; }
    const frames=[frame({type:'tree',nodes,active:[],visited:[],threads:kind==='threaded'},title,0)];
    order.forEach((id,i)=>frames.push(frame({type:'tree',nodes,active:[id],visited:order.slice(0,i+1),threads:kind==='threaded',queue:kind==='level'?order.slice(i+1,Math.min(order.length,i+3)):[]},`访问结点 ${id}`,kind==='level'?3:2,{node:id})));
    return {code,frames};
  }

  function bstTrace(kind='bst') {
    if(kind==='avl'){
      const code=['insert(root, 30);','insert(root, 20);','insert(root, 10);','if (balance(root) > 1) root = rotateRight(root);'];
      const snapshots=[
        [{id:'30',x:50,y:18,parent:null}],
        [{id:'30',x:50,y:18,parent:null},{id:'20',x:30,y:55,parent:'30'}],
        [{id:'30',x:62,y:18,parent:null},{id:'20',x:40,y:50,parent:'30'},{id:'10',x:18,y:78,parent:'20'}],
        [{id:'20',x:50,y:18,parent:null},{id:'10',x:28,y:58,parent:'20'},{id:'30',x:72,y:58,parent:'20'}]
      ];
      return {code,frames:[
        frame({type:'tree',nodes:snapshots[0],active:['30'],visited:[]},'插入 30 作为根结点',0),
        frame({type:'tree',nodes:snapshots[1],active:['20'],visited:[]},'20 < 30，插入左子树',1),
        frame({type:'tree',nodes:snapshots[2],active:['10'],visited:[]},'插入 10 后根结点平衡因子为 +2',2),
        frame({type:'tree',nodes:snapshots[3],active:['20'],visited:[],rotated:true},'出现 LL 型失衡，对 30 执行右旋',3)
      ]};
    }
    if(kind==='red-black'){
      const code=['insert(10); color(root, BLACK);','insert(20);','insert(30);','rotateLeft(10); recolor();'];
      const nodes1=[{id:'10',x:50,y:20,parent:null,color:'black'}];
      const nodes2=[...nodes1,{id:'20',x:70,y:55,parent:'10',color:'red'}];
      const nodes3=[...nodes2,{id:'30',x:84,y:82,parent:'20',color:'red'}];
      const nodes4=[{id:'20',x:50,y:20,parent:null,color:'black'},{id:'10',x:28,y:58,parent:'20',color:'red'},{id:'30',x:72,y:58,parent:'20',color:'red'}];
      return {code,frames:[frame({type:'tree',nodes:nodes1,active:['10']},'根结点染为黑色',0),frame({type:'tree',nodes:nodes2,active:['20']},'新结点默认染红，暂不改变黑高',1),frame({type:'tree',nodes:nodes3,active:['20','30']},'出现连续红结点，违反红黑树约束',2),frame({type:'tree',nodes:nodes4,active:['20'],rotated:true},'左旋并重新着色，恢复平衡',3)]};
    }
    if(kind==='b-tree'){
      const code=['insertKey(node, 10);','insertKey(node, 20);','insertKey(node, 30);','split(node); promote(20);'];
      return {code,frames:[
        frame({type:'btree',levels:[[['10']]]},'关键字 10 插入根结点',0),
        frame({type:'btree',levels:[[['10','20']]]},'同一结点按序保存多个关键字',1),
        frame({type:'btree',levels:[[['10','20','30']]],active:'root'},'结点关键字数量达到上限',2),
        frame({type:'btree',levels:[[['20']],[['10'],['30']]],active:'root'},'分裂结点并将中间关键字 20 提升',3)
      ]};
    }
    const values=[40,20,60,10,30,50,70];
    const code=['Node insert(Node root, int x) {','  if (root == null) return new Node(x);','  if (x < root.key) root.left = insert(root.left, x);','  else if (x > root.key) root.right = insert(root.right, x);','  return root;','}'];
    const frames=[]; const nodes=[];
    const positions=treeNodes();
    values.forEach((v,i)=>{nodes.push(positions.find(n=>n.id===String(v)));frames.push(frame({type:'tree',nodes,active:[String(v)],visited:[]},i===0?'创建根结点 40':`${v} 按大小关系插入二叉排序树`,i===0?1:(v<40?2:3),{x:v}));});
    return {code,frames};
  }

  /* ============================================================
     AVL 插入专属 trace（I1-A 样板工程 · 计划书工作流 D）
     真实 AVL 插入算法驱动：定位 → 插入 → 回溯更新高度 → 检测失衡 →
     判定 LL/RR/LR/RL 并旋转 → 结构验证。每帧携带语义字段 _meta：
       phase / condition / mutation / invariantChecks / cost
     帧末调用 window.AlgoraValidators.validateAVL 做结构断言。
     四种旋转可通过输入构造触发：
       [30,20,10]→LL  [10,20,30]→RR  [30,10,20]→LR  [10,30,20]→RL
     ============================================================ */
  function avlTrace(raw) {
    const keys = safeNums(raw, [30, 20, 10]).slice(0, 8);
    const nodes = {};   // id -> { id, key, left, right, height, parent, x, y }
    let rootId = null;
    const frames = [];
    // 行号与 code-library.js 的 AVL 代码 /*@N*/ 对应
    const L = { enter: 0, create: 1, recurse: 2, height: 3, balance: 4, ll: 5, rr: 6, lr: 7, rl: 8, ret: 9 };
    const meta = (f, m) => { f._meta = m; return f; };
    const h = (id) => (nodes[id] ? nodes[id].height : 0);
    const bf = (id) => (nodes[id] ? h(nodes[id].left) - h(nodes[id].right) : 0);

    function layout() {
      const inorder = [];
      (function walk(id) { if (!id) return; walk(nodes[id].left); inorder.push(id); walk(nodes[id].right); })(rootId);
      const n = inorder.length;
      inorder.forEach((id, i) => { nodes[id].x = n === 1 ? 50 : 5 + (i / (n - 1)) * 90; });
      (function setY(id, d) { if (!id) return; nodes[id].y = 12 + d * 24; setY(nodes[id].left, d + 1); setY(nodes[id].right, d + 1); })(rootId, 0);
    }
    function snap(active, extra) {
      return { type: 'tree', nodes: clone(Object.values(nodes)), active: active || [], visited: [], ...(extra || {}) };
    }
    function updateHeight(id) { const n = nodes[id]; if (n) n.height = 1 + Math.max(h(n.left), h(n.right)); }

    function rotateRight(yId) {
      const y = nodes[yId], x = nodes[y.left];
      y.left = x.right; if (x.right) nodes[x.right].parent = yId;
      x.right = yId; x.parent = y.parent; y.parent = x.id;
      if (x.parent == null) rootId = x.id;
      else { const p = nodes[x.parent]; if (p.left === yId) p.left = x.id; else p.right = x.id; }
      updateHeight(yId); updateHeight(x.id);
      return x.id;
    }
    function rotateLeft(xId) {
      const x = nodes[xId], y = nodes[x.right];
      x.right = y.left; if (y.left) nodes[y.left].parent = xId;
      y.left = xId; y.parent = x.parent; x.parent = y.id;
      if (y.parent == null) rootId = y.id;
      else { const p = nodes[y.parent]; if (p.left === xId) p.left = y.id; else p.right = y.id; }
      updateHeight(xId); updateHeight(y.id);
      return y.id;
    }

    function runValidator() {
      if (typeof window !== 'undefined' && window.AlgoraValidators && window.AlgoraValidators.validateAVL) {
        const vNodes = {};
        Object.values(nodes).forEach((n) => { vNodes[n.id] = { id: n.id, key: n.key, left: n.left, right: n.right, parent: n.parent, height: n.height }; });
        return window.AlgoraValidators.validateAVL({ root: rootId, nodes: vNodes });
      }
      return { ok: true, violations: [], degraded: true }; // 验证器未加载时优雅降级
    }

    const rotName = { LL: '右旋', RR: '左旋', LR: '先左旋后右旋', RL: '先右旋后左旋' };

    function insert(key) {
      const id = String(key);
      // —— 空树：创建根 ——
      if (!rootId) {
        nodes[id] = { id, key, left: null, right: null, height: 1, parent: null };
        rootId = id; layout();
        frames.push(meta(frame(snap([id]), `插入 ${key} 作为根结点（高度 1 · 平衡因子 0）`, L.create, { key }), {
          phase: 'mutate', mutation: { type: 'allocate', targets: [id] },
          invariantChecks: ['bst-order', 'avl-balance', 'height-consistency'],
          cost: { comparisons: 0, reads: 1, writes: 1, allocations: 1 }
        }));
        return;
      }
      // —— 定位插入位置 ——
      let cur = rootId; const path = [];
      while (cur) {
        path.push(cur);
        const goLeft = key < nodes[cur].key;
        frames.push(meta(frame(snap([cur]), `比较 ${key} 与结点 ${cur}：${key} ${goLeft ? '<' : '>'} ${cur}，进入${goLeft ? '左' : '右'}子树`, L.recurse, { key, cur: Number(cur) }), {
          phase: 'locate', condition: `${key} ${goLeft ? '<' : '>'} ${nodes[cur].key}`,
          cost: { comparisons: 1, reads: 1 }
        }));
        if (goLeft) { if (!nodes[cur].left) break; cur = nodes[cur].left; }
        else { if (!nodes[cur].right) break; cur = nodes[cur].right; }
      }
      // —— 插入新结点 ——
      const parentId = cur;
      nodes[id] = { id, key, left: null, right: null, height: 1, parent: parentId };
      if (key < nodes[parentId].key) nodes[parentId].left = id; else nodes[parentId].right = id;
      layout();
      frames.push(meta(frame(snap([id]), `创建结点 ${key}，挂到 ${parentId} 的${key < nodes[parentId].key ? '左' : '右'}子树（叶子高度 1）`, L.create, { key }), {
        phase: 'mutate', mutation: { type: 'insert', targets: [parentId, id] },
        invariantChecks: ['bst-order'],
        cost: { comparisons: 1, reads: 1, writes: 2, allocations: 1 }
      }));
      // —— 回溯更新高度 + 检测失衡 ——
      let unbalanced = null, rotType = null;
      for (let i = path.length - 1; i >= 0; i--) {
        const p = path[i]; updateHeight(p);
        frames.push(meta(frame(snap([p]), `回溯：结点 ${p} 高度更新为 ${nodes[p].height}`, L.height, { height: nodes[p].height }), {
          phase: 'repair', condition: 'height = 1 + max(h(left), h(right))',
          invariantChecks: ['height-consistency'],
          cost: { reads: 2, writes: 1 }
        }));
        const bal = bf(p);
        frames.push(meta(frame(snap([p]), `计算结点 ${p} 平衡因子 = ${bal}${Math.abs(bal) > 1 ? ' —— 超出 [-1,1]，失衡！' : ''}`, L.balance, { balance: bal }), {
          phase: 'repair', condition: `balance = h(left) − h(right) = ${bal}`,
          invariantChecks: ['avl-balance'], cost: { comparisons: 1, reads: 2 }
        }));
        if (Math.abs(bal) > 1) { unbalanced = p; break; }
      }
      // —— 判定旋转类型并执行 ——
      if (unbalanced) {
        const bal = bf(unbalanced);
        if (bal > 1) rotType = (key < nodes[nodes[unbalanced].left].key) ? 'LL' : 'LR';
        else rotType = (key > nodes[nodes[unbalanced].right].key) ? 'RR' : 'RL';
        const primaryRot = (rotType === 'LL' || rotType === 'LR') ? 'rotateRight' : 'rotateLeft';
        frames.push(meta(frame(snap([unbalanced]), `结点 ${unbalanced} 失衡（平衡因子 ${bal}），判定为 ${rotType} 型，执行${rotName[rotType]}`, L[rotType === 'LL' ? 'll' : rotType === 'RR' ? 'rr' : rotType === 'LR' ? 'lr' : 'rl'], { balance: bal }), {
          phase: 'repair', condition: `${rotType}：balance=${bal}, 新结点 key=${key}`,
          mutation: { type: primaryRot, targets: [unbalanced] },
          invariantChecks: ['avl-balance', 'height-consistency'],
          cost: { comparisons: 1, reads: 3, writes: 3, swaps: 1 }
        }));
        if (rotType === 'LL') rotateRight(unbalanced);
        else if (rotType === 'RR') rotateLeft(unbalanced);
        else if (rotType === 'LR') {
          // 双旋第一步：对失衡结点左孩子先左旋
          const leftId = nodes[unbalanced].left;
          rotateLeft(leftId); layout();
          frames.push(meta(frame(snap([leftId]), `LR 双旋第一步：对左孩子 ${leftId} 执行左旋`, L.lr), {
            phase: 'repair', mutation: { type: 'rotateLeft', targets: [leftId] },
            invariantChecks: ['height-consistency'], cost: { reads: 2, writes: 2 }
          }));
          rotateRight(unbalanced); // 第二步：失衡结点右旋
        } else {
          // RL 双旋第一步：对失衡结点右孩子先右旋
          const rightId = nodes[unbalanced].right;
          rotateRight(rightId); layout();
          frames.push(meta(frame(snap([rightId]), `RL 双旋第一步：对右孩子 ${rightId} 执行右旋`, L.rl), {
            phase: 'repair', mutation: { type: 'rotateRight', targets: [rightId] },
            invariantChecks: ['height-consistency'], cost: { reads: 2, writes: 2 }
          }));
          rotateLeft(unbalanced); // 第二步：失衡结点左旋
        }
        layout();
        frames.push(meta(frame(snap([rootId], { rotated: true }), `${rotName[rotType]}完成，树恢复平衡`, L.ret), {
          phase: 'repair',
          mutation: { type: 'rotate', targets: [rootId] },
          invariantChecks: ['bst-order', 'avl-balance', 'height-consistency'],
          cost: { reads: 2, writes: 2 }
        }));
      }
      // —— 结构验证 ——
      const res = runValidator();
      frames.push(meta(frame(snap([], res.ok ? { success: true } : {}),
        res.ok
          ? (res.degraded ? '（验证器未加载，跳过结构断言）' : '✅ 结构验证通过：中序有序 · 高度一致 · 平衡因子 ∈ [-1,1]')
          : `⚠️ 结构验证失败：${res.violations.map((v) => v.detail).join('；')}`,
        L.ret), {
        phase: 'verify',
        invariantChecks: ['bst-order', 'avl-balance', 'height-consistency'],
        invariantResult: res,
        cost: { reads: 1 }
      }));
    }

    keys.forEach((k) => insert(k));
    const code = [
      'Node* insert(Node* root, int key) {',
      '  if (!root) return new Node(key);',
      '  if (key < root->key) root->left = insert(root->left, key);',
      '  else root->right = insert(root->right, key);',
      '  root->height = 1 + max(height(root->left), height(root->right));',
      '  int balance = height(root->left) - height(root->right);',
      '  if (balance > 1 && key < root->left->key) return rotateRight(root); // LL',
      '  if (balance < -1 && key > root->right->key) return rotateLeft(root); // RR',
      '  if (balance > 1) { root->left = rotateLeft(root->left); return rotateRight(root); } // LR',
      '  if (balance < -1) { root->right = rotateRight(root->right); return rotateLeft(root); } // RL',
      '  return root;',
      '}'
    ];
    return { code, frames };
  }

  function huffmanTrace() {
    const code=['put all weights into minHeap;','while (heap.size() > 1) {','  Node a = heap.popMin();','  Node b = heap.popMin();','  heap.push(new Node(a.weight + b.weight, a, b));','}'];
    const frames=[
      frame({type:'huffman',groups:[[5],[7],[10],[15],[20],[45]],active:[0,1]},'选择权值最小的 5 和 7',2),
      frame({type:'huffman',groups:[[10],[12],[15],[20],[45]],active:[0,1]},'合并得到新权值 12',4),
      frame({type:'huffman',groups:[[15],[20],[22],[45]],active:[0,2]},'合并 10 与 12 得到 22',4),
      frame({type:'huffman',groups:[[22],[35],[45]],active:[1]},'合并 15 与 20 得到 35',4),
      frame({type:'huffman',groups:[[45],[57]],active:[1]},'合并 22 与 35 得到 57',4),
      frame({type:'huffman',groups:[[102]],active:[0],success:true},'合并 45 与 57，构造完成',4)
    ]; return {code,frames};
  }

  function graphStorageTrace(matrix=false) {
    const graph=basicGraph();
    const code=matrix?['matrix[u][v] = weight;','matrix[v][u] = weight;']:['adj[u].add(v, weight);','adj[v].add(u, weight);'];
    const frames=[frame({type:'graph',...graph,activeNodes:[],activeEdges:[],showMatrix:matrix,showList:!matrix},matrix?'使用 V×V 矩阵保存边':'每个顶点维护邻接边列表',0)];
    graph.edges.slice(0,6).forEach((e,i)=>frames.push(frame({type:'graph',...graph,activeNodes:e.slice(0,2),activeEdges:[e.slice(0,2)],showMatrix:matrix,showList:!matrix,builtEdges:graph.edges.slice(0,i+1)},`记录边 ${e[0]}—${e[1]}，权值 ${e[2]}`,0)));
    return {code,frames};
  }

  function traversalTrace(kind='bfs') {
    const graph=basicGraph();
    const adjacency={A:['B','F'],B:['A','C','F','E'],C:['B','D','E'],D:['C','E'],E:['B','C','D','F'],F:['A','B','E']};
    const code=kind==='bfs'?['queue.offer(start);','while (!queue.empty()) {','  u = queue.poll(); visit(u);','  for (v : adj[u]) if (!visited[v]) queue.offer(v);','}']:['dfs(u) {','  visit(u);','  for (v : adj[u])','    if (!visited[v]) dfs(v);','}'];
    const order=[]; const frames=[];
    if(kind==='bfs'){
      const q=['A'], seen=new Set(['A']);
      while(q.length){const u=q.shift();order.push(u);frames.push(frame({type:'graph',...graph,activeNodes:[u],visited:order,frontier:q},`队头取出 ${u} 并访问`,2,{queue:q.join(',')}));for(const v of adjacency[u])if(!seen.has(v)){seen.add(v);q.push(v);frames.push(frame({type:'graph',...graph,activeNodes:[u,v],activeEdges:[[u,v]],visited:order,frontier:q},`发现未访问邻点 ${v}，加入队列`,3,{queue:q.join(',')}));}}
    } else {
      const seen=new Set();
      const dfs=u=>{seen.add(u);order.push(u);frames.push(frame({type:'graph',...graph,activeNodes:[u],visited:order,frontier:[]},`递归访问 ${u}`,1,{depth:order.length}));for(const v of adjacency[u])if(!seen.has(v)){frames.push(frame({type:'graph',...graph,activeNodes:[u,v],activeEdges:[[u,v]],visited:order},`沿边 ${u}—${v} 深入`,3));dfs(v);}}; dfs('A');
    }
    return {code,frames};
  }

  function primTrace() {
    const graph=basicGraph(); const code=['selected.add(A);','while (selected.size < V) {','  edge = minCrossingEdge();','  tree.add(edge); selected.add(edge.to);','}'];
    const chosen=[['A','F'],['F','B'],['B','C'],['C','D'],['D','E']]; const visited=['A'];
    const frames=[frame({type:'graph',...graph,visited,treeEdges:[],activeNodes:['A']},'从顶点 A 开始生成最小生成树',0)];
    chosen.forEach((e,i)=>{if(!visited.includes(e[0]))visited.push(e[0]);if(!visited.includes(e[1]))visited.push(e[1]);frames.push(frame({type:'graph',...graph,visited,treeEdges:chosen.slice(0,i+1),activeEdges:[e],activeNodes:e},`选择跨集合最小边 ${e[0]}—${e[1]}`,2));});
    return {code,frames};
  }

  function kruskalTrace() {
    const graph=basicGraph(); const code=['sort(edges by weight);','for (edge : edges) {','  if (find(u) != find(v)) {','    union(u, v); tree.add(edge);','  }','}'];
    const sorted=graph.edges.slice().sort((a,b)=>a[2]-b[2]); const selected=[]; const parent={}; graph.nodes.forEach(n=>parent[n.id]=n.id);
    const find=x=>parent[x]===x?x:(parent[x]=find(parent[x]));
    const frames=[];
    for(const e of sorted){const [u,v]=e;if(find(u)!==find(v)){parent[find(u)]=find(v);selected.push([u,v]);frames.push(frame({type:'graph',...graph,treeEdges:selected,activeEdges:[[u,v]],activeNodes:[u,v]},`边 ${u}—${v} 不形成环，加入生成树`,3));}else frames.push(frame({type:'graph',...graph,treeEdges:selected,activeEdges:[[u,v]],rejectedEdges:[[u,v]]},`边 ${u}—${v} 会形成环，舍弃`,2));if(selected.length===graph.nodes.length-1)break;}
    return {code,frames};
  }

  function shortestPathTrace(kind='dijkstra') {
    const graph=basicGraph(); const code=kind==='bellman'?['dist[start] = 0;','repeat V-1 times:','  for each edge (u,v,w)','    if (dist[u]+w < dist[v]) dist[v] = dist[u]+w;','check one more round for negative cycle;']:['dist[start] = 0;','while (unsettled not empty) {','  u = extractMin();','  for (edge u→v) relax(u,v);','}'];
    const edges=graph.edges; const dist={A:0,B:Infinity,C:Infinity,D:Infinity,E:Infinity,F:Infinity}; const frames=[frame({type:'graph',...graph,distances:dist,activeNodes:['A'],visited:[]},'起点 A 的距离设为 0，其余为 ∞',0)];
    if(kind==='bellman'){
      for(let round=1;round<=2;round++) for(const [u,v,w] of edges){for(const [a,b] of [[u,v],[v,u]]){if(dist[a]!==Infinity&&dist[a]+w<dist[b]){dist[b]=dist[a]+w;frames.push(frame({type:'graph',...graph,distances:dist,activeNodes:[a,b],activeEdges:[[a,b]],visited:[]},`第 ${round} 轮：松弛 ${a}→${b}，dist[${b}]=${dist[b]}`,3,{round}));}}}return {code,frames};
    }
    const adj={};graph.nodes.forEach(n=>adj[n.id]=[]);edges.forEach(([u,v,w])=>{adj[u].push([v,w]);adj[v].push([u,w]);});const done=new Set();
    while(done.size<graph.nodes.length){let u=null,best=Infinity;for(const n of graph.nodes)if(!done.has(n.id)&&dist[n.id]<best){best=dist[n.id];u=n.id;}if(u===null)break;done.add(u);frames.push(frame({type:'graph',...graph,distances:dist,activeNodes:[u],visited:[...done]},`确定当前最近顶点 ${u}，距离 ${dist[u]}`,2));for(const [v,w] of adj[u])if(!done.has(v)&&dist[u]+w<dist[v]){dist[v]=dist[u]+w;frames.push(frame({type:'graph',...graph,distances:dist,activeNodes:[u,v],activeEdges:[[u,v]],visited:[...done]},`松弛 ${u}→${v}，新距离 ${dist[v]}`,3));}}
    return {code,frames};
  }

  function floydTrace() {
    const graph=basicGraph(); const labels=graph.nodes.map(n=>n.id).slice(0,4); const n=labels.length; const inf=99; const m=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:inf));
    graph.edges.forEach(([u,v,w])=>{const i=labels.indexOf(u),j=labels.indexOf(v);if(i>=0&&j>=0)m[i][j]=m[j][i]=w;});
    const code=['for (k = 0; k < n; k++)','  for (i = 0; i < n; i++)','    for (j = 0; j < n; j++)','      dist[i][j] = min(dist[i][j], dist[i][k]+dist[k][j]);'];
    const frames=[frame({type:'matrix',matrix:m,labels,active:[]},'初始距离矩阵：无直接边记为 ∞',0)];
    for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(m[i][k]+m[k][j]<m[i][j]){m[i][j]=m[i][k]+m[k][j];frames.push(frame({type:'matrix',matrix:m.map(r=>r.map(v=>v===inf?'∞':v)),labels,active:[[i,j],[i,k],[k,j]],pivot:[k,k]},`允许 ${labels[k]} 作为中间点，更新 ${labels[i]}→${labels[j]} = ${m[i][j]}`,3,{i,j,k}));}
    return {code,frames};
  }

  function topoTrace(critical=false) {
    const graph=dagGraph(); const code=critical?['topologicalOrder();','ve[v] = max(ve[v], ve[u] + w);','vl[u] = min(vl[u], vl[v] - w);','if (e(activity) == l(activity)) markCritical();']:['compute indegree[];','push all zero-indegree vertices;','while (!queue.empty()) {','  u = pop(); output(u);','  for (v : adj[u]) if (--indegree[v] == 0) push(v);','}'];
    if(critical){
      const criticalEdges=[['A','B'],['B','E'],['E','F']]; return {code,frames:[
        frame({type:'graph',...graph,activeNodes:['A'],treeEdges:[],distances:{A:0,B:3,C:2,D:5,E:6,F:8}},'正向计算事件最早发生时间 ve',1),
        frame({type:'graph',...graph,activeNodes:['F'],treeEdges:[],distances:{A:0,B:3,C:2,D:5,E:6,F:8}},'逆向计算事件最迟发生时间 vl',2),
        frame({type:'graph',...graph,activeEdges:criticalEdges,treeEdges:criticalEdges,activeNodes:['A','B','E','F']},'活动最早开始时间等于最迟开始时间，构成关键路径 A→B→E→F',3)
      ]};
    }
    const indeg={A:0,B:1,C:1,D:1,E:2,F:2},order=[],queue=['A'],frames=[];
    while(queue.length){const u=queue.shift();order.push(u);frames.push(frame({type:'graph',...graph,activeNodes:[u],visited:order,frontier:queue,labels:indeg},`输出入度为 0 的顶点 ${u}`,3));for(const [a,b] of graph.edges)if(a===u){indeg[b]--;frames.push(frame({type:'graph',...graph,activeNodes:[u,b],activeEdges:[[u,b]],visited:order,frontier:queue,labels:indeg},`删除边 ${u}→${b}，${b} 的入度减为 ${indeg[b]}`,4));if(indeg[b]===0)queue.push(b);}}
    return {code,frames};
  }

  function searchTrace(raw, kind='linear') {
    let arr=safeNums(raw,[7,12,18,23,31,42,56,68]); const target=31;
    if(kind!=='linear')arr=arr.slice().sort((a,b)=>a-b);
    const code=kind==='binary'?['int left = 0, right = n - 1;','while (left <= right) {','  int mid = (left + right) / 2;','  if (a[mid] == target) return mid;','  if (a[mid] < target) left = mid + 1;','  else right = mid - 1;','} return -1;']:['for (int i = 0; i < n; i++) {','  if (a[i] == target) return i;',kind==='ordered'?'  if (a[i] > target) break;':'  // 继续扫描','}','return -1;'];
    const frames=[];
    if(kind==='binary'){
      let l=0,r=arr.length-1;while(l<=r){const mid=Math.floor((l+r)/2);frames.push(frame({type:'array',values:arr,active:[mid],range:[l,r],pointers:{left:l,mid,right:r}},`比较中点 a[${mid}]=${arr[mid]} 与目标 ${target}`,2,{left:l,mid,right:r}));if(arr[mid]===target){frames.push(frame({type:'array',values:arr,active:[mid],found:[mid],range:[l,r]},`找到目标，索引为 ${mid}`,3));break;}if(arr[mid]<target)l=mid+1;else r=mid-1;}
    } else {
      for(let i=0;i<arr.length;i++){frames.push(frame({type:'array',values:arr,active:[i],pointers:{i}},`比较 a[${i}]=${arr[i]} 与 ${target}`,0,{i}));if(arr[i]===target){frames.push(frame({type:'array',values:arr,active:[i],found:[i]},`找到目标，索引为 ${i}`,1));break;}if(kind==='ordered'&&arr[i]>target){frames.push(frame({type:'array',values:arr,active:[i]},'当前元素已经大于目标，可提前结束',2));break;}}
    }
    return {code,frames};
  }

  function hashTrace(raw, chaining=true) {
    const values=safeNums(raw,[18,29,36,47,58,69]); const size=7; const code=chaining?['int index = key % tableSize;','table[index].add(key);']:['int index = key % tableSize;','while (table[index] occupied) index = (index + 1) % tableSize;','table[index] = key;'];
    const buckets=Array.from({length:size},()=>[]),frames=[];
    for(const value of values){let idx=value%size;if(chaining){buckets[idx].push(value);frames.push(frame({type:'hash',buckets,active:idx,value,chaining},`${value} % ${size} = ${idx}，加入桶 ${idx} 的链表`,1));}else{const start=idx;while(buckets[idx].length)idx=(idx+1)%size;buckets[idx]=[value];frames.push(frame({type:'hash',buckets,active:idx,value,chaining,probeFrom:start},idx===start?`${value} 放入槽 ${idx}`:`槽 ${start} 冲突，线性探测至槽 ${idx}`,idx===start?2:1));}}
    return {code,frames};
  }

  function sortTrace(raw, kind='bubble') {
    const a=safeNums(raw,[42,17,8,33,21,5,29]).slice(0,10); const frames=[];
    const codeMap={
      insertion:['for (i = 1; i < n; i++) {','  key = a[i]; j = i - 1;','  while (j >= 0 && a[j] > key) a[j+1] = a[j--];','  a[j+1] = key;','}'],
      binaryInsertion:['for (i = 1; i < n; i++) {','  pos = binarySearch(a, 0, i-1, a[i]);','  shiftRight(pos, i-1);','  a[pos] = key;','}'],
      shell:['for (gap = n/2; gap > 0; gap /= 2)','  for (i = gap; i < n; i++)','    gapInsertionSort(a, i, gap);'],
      bubble:['for (end = n-1; end > 0; end--)','  for (i = 0; i < end; i++)','    if (a[i] > a[i+1]) swap(a[i], a[i+1]);'],
      quick:['quickSort(left, right) {','  pivot = partition(left, right);','  quickSort(left, pivot-1);','  quickSort(pivot+1, right);','}'],
      selection:['for (i = 0; i < n-1; i++) {','  min = i;','  for (j = i+1; j < n; j++) if (a[j] < a[min]) min = j;','  swap(a[i], a[min]);','}'],
      heap:['buildMaxHeap(a);','for (end = n-1; end > 0; end--) {','  swap(a[0], a[end]);','  siftDown(a, 0, end);','}'],
      merge:['mergeSort(left, right) {','  mid = (left + right) / 2;','  mergeSort(left, mid); mergeSort(mid+1, right);','  merge(left, mid, right);','}'],
      radix:['for (exp = 1; max/exp > 0; exp *= 10)','  stableCountingSortByDigit(a, exp);']
    };
    const push=(msg,line,active=[],sorted=[],range=null,extra={})=>frames.push(frame({type:'bars',values:a,active,sorted,range,...extra},msg,line));
    push('初始序列',0);
    if(kind==='bubble'){
      for(let end=a.length-1;end>0;end--){for(let i=0;i<end;i++){push(`比较 ${a[i]} 与 ${a[i+1]}`,1,[i,i+1],Array.from({length:a.length-end-1},(_,k)=>a.length-1-k));if(a[i]>a[i+1]){[a[i],a[i+1]]=[a[i+1],a[i]];push('逆序，交换相邻元素',2,[i,i+1],[]);}}push(`位置 ${end} 已确定`,0,[end],Array.from({length:a.length-end},(_,k)=>a.length-1-k));}
    } else if(kind==='insertion'||kind==='binaryInsertion'){
      for(let i=1;i<a.length;i++){const key=a[i];let pos=i;if(kind==='binaryInsertion'){let l=0,r=i-1;while(l<=r){const m=Math.floor((l+r)/2);push(`折半比较 key=${key} 与 a[${m}]=${a[m]}`,1,[m,i],Array.from({length:i},(_,k)=>k),[l,r]);if(a[m]<=key)l=m+1;else r=m-1;}pos=l;}else{while(pos>0&&a[pos-1]>key)pos--;}
        for(let j=i;j>pos;j--){a[j]=a[j-1];push(`元素右移，为 ${key} 腾出位置`,2,[j-1,j],Array.from({length:i},(_,k)=>k));}a[pos]=key;push(`将 ${key} 插入位置 ${pos}`,3,[pos],Array.from({length:i+1},(_,k)=>k));}
    } else if(kind==='selection'){
      for(let i=0;i<a.length-1;i++){let min=i;for(let j=i+1;j<a.length;j++){push(`在未排序区间寻找最小值`,2,[min,j],Array.from({length:i},(_,k)=>k));if(a[j]<a[min])min=j;}[a[i],a[min]]=[a[min],a[i]];push(`最小值交换到位置 ${i}`,3,[i,min],Array.from({length:i+1},(_,k)=>k));}
    } else if(kind==='shell'){
      for(let gap=Math.floor(a.length/2);gap>0;gap=Math.floor(gap/2)){for(let i=gap;i<a.length;i++){let temp=a[i],j=i;while(j>=gap&&a[j-gap]>temp){a[j]=a[j-gap];push(`gap=${gap}：组内元素后移`,2,[j-gap,j],[],null,{gap});j-=gap;}a[j]=temp;push(`gap=${gap}：插入 ${temp}`,2,[j],[],null,{gap});}}
    } else if(kind==='quick'){
      const quick=(l,r)=>{if(l>=r)return;const pivot=a[r];let i=l;push(`选择枢轴 ${pivot}`,1,[r],[],[l,r],{pivot:r});for(let j=l;j<r;j++){push(`将 ${a[j]} 与枢轴比较`,1,[j,r],[],[l,r],{pivot:r});if(a[j]<pivot){[a[i],a[j]]=[a[j],a[i]];push('较小元素交换到枢轴左侧',1,[i,j],[],[l,r]);i++;}}[a[i],a[r]]=[a[r],a[i]];push(`枢轴落位到 ${i}`,1,[i], [i],[l,r],{pivot:i});quick(l,i-1);quick(i+1,r);};quick(0,a.length-1);
    } else if(kind==='merge'){
      const mergeSort=(l,r)=>{if(l>=r)return;const m=Math.floor((l+r)/2);mergeSort(l,m);mergeSort(m+1,r);const temp=[];let i=l,j=m+1;while(i<=m&&j<=r)temp.push(a[i]<=a[j]?a[i++]:a[j++]);while(i<=m)temp.push(a[i++]);while(j<=r)temp.push(a[j++]);for(let k=0;k<temp.length;k++)a[l+k]=temp[k];push(`合并区间 [${l}, ${m}] 与 [${m+1}, ${r}]`,3,Array.from({length:r-l+1},(_,k)=>l+k),[],[l,r]);};mergeSort(0,a.length-1);
    } else if(kind==='heap'){
      const sift=(n,i)=>{while(true){let largest=i,l=2*i+1,r=2*i+2;if(l<n&&a[l]>a[largest])largest=l;if(r<n&&a[r]>a[largest])largest=r;if(largest===i)break;[a[i],a[largest]]=[a[largest],a[i]];push('下沉调整大根堆',3,[i,largest],[]);i=largest;}};for(let i=Math.floor(a.length/2)-1;i>=0;i--)sift(a.length,i);push('大根堆建立完成',0,[0],[]);for(let end=a.length-1;end>0;end--){[a[0],a[end]]=[a[end],a[0]];push('堆顶最大值交换到末尾',2,[0,end],Array.from({length:a.length-end},(_,k)=>a.length-1-k));sift(end,0);}
    } else if(kind==='radix'){
      const max=Math.max(...a);for(let exp=1;Math.floor(max/exp)>0;exp*=10){const buckets=Array.from({length:10},()=>[]);a.forEach(v=>buckets[Math.floor(v/exp)%10].push(v));let k=0;buckets.forEach(bucket=>bucket.forEach(v=>a[k++]=v));push(`按 ${exp===1?'个位':exp===10?'十位':'更高位'} 分配并收集`,1,[],[],null,{buckets,exp});}
    }
    push('排序完成',0,[],Array.from({length:a.length},(_,k)=>k));
    return {code:codeMap[kind],frames};
  }

  function genericTrace(module) {
    const code=['initialize structure;','for each operation:','  inspect current state;','  update links or indices;','verify invariant;'];
    const frames=[
      frame({type:module.type||'array',values:[12,24,36,48],active:[0]},`初始化 ${module.title}`,0),
      frame({type:module.type||'array',values:[12,24,36,48],active:[1,2]},'观察关键元素之间的关系',2),
      frame({type:module.type||'array',values:[12,24,36,48],active:[],success:true},'操作完成并验证结构不变量',4)
    ]; return {code,frames};
  }

  window.buildTrace = function buildTrace(module, rawInput) {
    const id=module.demo;
    if(id==='sequence') return sequenceTrace(rawInput);
    if(id==='linked') return linkedTrace(rawInput,'single');
    if(id==='linked-head') return linkedTrace(rawInput,'single-head');
    if(id==='doubly') return linkedTrace(rawInput,'doubly');
    if(id==='doubly-head') return linkedTrace(rawInput,'doubly-head');
    if(id==='circular-singly') return linkedTrace(rawInput,'circular');
    if(id==='circular-doubly') return linkedTrace(rawInput,'circular-doubly');
    if(id==='static-list') return staticListTrace(rawInput);
    if(id==='stack') return stackTrace(rawInput,false);
    if(id==='linked-stack') return stackTrace(rawInput,true);
    if(id==='queue'||id==='linked-queue') return queueTrace(rawInput,false,false);
    if(id==='circular-queue') return queueTrace(rawInput,true,false);
    if(id==='deque') return queueTrace(rawInput,false,true);
    if(id==='bracket') return bracketTrace();
    if(id==='expression') return expressionTrace();
    if(id==='level-order') return treeTrace('level');
    if(id==='array-storage'||id==='symmetric'||id==='triangular'||id==='tridiagonal'||id==='sparse') return matrixTrace(id==='array-storage'?'array':id);
    if(id==='naive-match') return stringTrace(false);
    if(id==='kmp') return stringTrace(true);
    if(id==='binary-tree') return treeTrace('binary');
    if(id==='bst') return bstTrace('bst');
    if(id==='huffman') return huffmanTrace();
    if(id==='threaded') return treeTrace('threaded');
    if(id==='avl') return avlTrace(rawInput);
    if(id==='adj-matrix') return graphStorageTrace(true);
    if(id==='adj-list') return graphStorageTrace(false);
    if(id==='bfs') return traversalTrace('bfs');
    if(id==='dfs') return traversalTrace('dfs');
    if(id==='prim') return primTrace();
    if(id==='kruskal') return kruskalTrace();
    if(id==='dijkstra') return shortestPathTrace('dijkstra');
    if(id==='floyd') return floydTrace();
    if(id==='bellman') return shortestPathTrace('bellman');
    if(id==='topological') return topoTrace(false);
    if(id==='critical-path') return topoTrace(true);
    if(id==='linear-search') return searchTrace(rawInput,'linear');
    if(id==='ordered-linear-search') return searchTrace(rawInput,'ordered');
    if(id==='binary-search') return searchTrace(rawInput,'binary');
    if(id==='red-black') return bstTrace('red-black');
    if(id==='b-tree') return bstTrace('b-tree');
    if(id==='hash-chain') return hashTrace(rawInput,true);
    if(id==='hash-open') return hashTrace(rawInput,false);
    if(id.endsWith('-sort')){
      const map={'insertion-sort':'insertion','binary-insertion-sort':'binaryInsertion','shell-sort':'shell','bubble-sort':'bubble','quick-sort':'quick','selection-sort':'selection','heap-sort':'heap','merge-sort':'merge','radix-sort':'radix'};
      return sortTrace(rawInput,map[id]);
    }
    return genericTrace(module);
  };
})();
