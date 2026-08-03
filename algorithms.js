(function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const frame = (visual, message, line = 0, vars = {}) => ({ visual: clone(visual), message, line, vars });
  const safeNums = (raw, fallback = [42, 17, 8, 33, 21, 5, 29]) => {
    // I4-A 修复：空输入/空串不得被 Number('')===0 吞掉，须走 fallback
    const values = String(raw || '').split(/[，,\s]+/).map(s => s.trim()).filter(s => s !== '').map(Number).filter(Number.isFinite).slice(0, 12);
    return values.length ? values : fallback.slice();
  };
  // I4-C：图输入解析（边列表语法 'A-B:5, B-C:2'；支持负权、环、有向箭头 →）
  // 返回 { nodes, edges, directed } 或 null（格式非法）
  const parseGraphInput = (raw, fallback, directed = false) => {
    if (!raw || !String(raw).trim()) return fallback();
    const seen = new Set(); const edges = [];
    for (const part of String(raw).split(/[;,，]/)) {
      const m = part.trim().match(/^([A-Za-z0-9]+)\s*(?:[-–]|→)\s*([A-Za-z0-9]+)\s*:\s*(-?\d+)$/);
      if (!m) return null;
      const u = m[1], v = m[2], w = Number(m[3]);
      seen.add(u); seen.add(v); edges.push([u, v, w]);
    }
    if (seen.size === 0) return fallback();
    const ids = [...seen];
    const nodes = ids.map((id, i) => {
      const angle = (i / ids.length) * 2 * Math.PI - Math.PI / 2;
      return { id, x: Math.round(50 + 34 * Math.cos(angle)), y: Math.round(50 + 32 * Math.sin(angle)) };
    });
    return { directed, nodes, edges };
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
    const code=linked?[
      'Node* push(Node* top, int x) {',
      '  Node* s = new Node(x);',
      '  s->next = top;      // 新结点指向原栈顶',
      '  top = s;            // 栈顶指针上移',
      '  return top;',
      '}','',
      'Node* pop(Node* top) {',
      '  Node* s = top;      // 记录栈顶',
      '  top = top->next;    // 栈顶指针下移',
      '  delete s;',
      '  return top;',
      '}'
    ]:['void push(Stack S, int x) {','  S.data[S.top++] = x;','}','int pop(Stack S) {','  return S.data[--S.top];','}'];
    if(linked){
      // 链栈：结点 + top 指针视图（文档工作流 B：不再复用数组方块视图）
      const frames=[frame({type:'linked',values:[...values],active:[values.length-1],topIndex:values.length-1,linkedStack:true},'栈底 → 栈顶 的单向链表；top 指针指向栈顶结点',0,{top:values[values.length-1]})];
      const pushed=[...values,88];
      frames.push(frame({type:'linked',values:pushed,active:[pushed.length-1],inserted:[pushed.length-1],topIndex:pushed.length-1,linkedStack:true},'push(88)：创建新结点并让 top 指向它（s->next = 原top）',1,{top:88}));
      frames.push(frame({type:'linked',values:pushed,active:[pushed.length-1],topIndex:pushed.length-1,linkedStack:true},'pop()：top 指向栈顶结点',2,{top:88}));
      const popped=pushed.slice(0,-1);
      frames.push(frame({type:'linked',values:popped,active:[],topIndex:popped.length-1,linkedStack:true},'88 出栈：top 下移到下一个结点',3,{top:popped.length?popped[popped.length-1]:null}));
      return {code,frames};
    }
    const frames=[frame({type:'stack',values,active:[values.length-1],linked},'栈顶位于最后一个元素',0,{top:values.length})];
    const pushed=[...values,88];
    frames.push(frame({type:'stack',values:pushed,active:[pushed.length-1],inserted:[pushed.length-1],linked},'执行 push(88)：元素进入栈顶',1,{top:pushed.length}));
    frames.push(frame({type:'stack',values:pushed,active:[pushed.length-1],linked},'执行 pop()：读取栈顶元素',4,{top:pushed.length}));
    frames.push(frame({type:'stack',values,active:[],linked},'88 出栈，top 指针回退',4,{top:values.length,result:88}));
    return {code,frames};
  }

  function queueTrace(raw, circular=false, deque=false, linked=false) {
    const values=safeNums(raw,[11,23,34,48]).slice(0,6);
    if(linked){
      // 链队列：结点 + front/rear 指针视图（文档工作流 B）
      const code=['Node* front, *rear;','void enqueue(int x) {','  Node* s = new Node(x);','  rear->next = s;   // 尾插：新结点接到队尾','  rear = s;         // rear 后移','}','int dequeue() {','  Node* s = front;  // 头删','  front = front->next;','  return s->value;','}'];
      const frames=[frame({type:'linked',values:[...values],active:[0,values.length-1],frontIndex:0,rearIndex:values.length-1,linkedQueue:true},'front 指向队头结点，rear 指向队尾结点（带头结点时 front 先指向哨兵）',0,{front:values[0],rear:values[values.length-1]})];
      const enqueued=[...values,77];
      frames.push(frame({type:'linked',values:enqueued,active:[enqueued.length-1],inserted:[enqueued.length-1],frontIndex:0,rearIndex:enqueued.length-1,linkedQueue:true},'enqueue(77)：新结点接到队尾，rear 后移',1,{rear:77}));
      frames.push(frame({type:'linked',values:enqueued,active:[0],frontIndex:0,rearIndex:enqueued.length-1,linkedQueue:true},`读取队头元素 ${enqueued[0]}`,2,{front:enqueued[0]}));
      const after=enqueued.slice(1);
      frames.push(frame({type:'linked',values:after,active:[],frontIndex:0,rearIndex:after.length-1,linkedQueue:true},'dequeue()：front 前移到下一个结点',3,{front:after[0]||null}));
      return {code,frames};
    }
    const code = deque ? [
      'deque.addLast(77);','deque.addFirst(6);','int x = deque.removeLast();','int y = deque.removeFirst();'
    ] : (circular ? [
      'rear = (rear + 1) % capacity;',      // 入队：rear 前移（模运算复用空间）
      'queue[rear] = value;',
      'value = queue[front];',
      'front = (front + 1) % capacity;',    // 出队：front 前移
      '// 空：front == rear；满：(rear+1)%cap == front（牺牲一个单元）'
    ] : [
      'queue[rear] = value;','rear = (rear + 1) % capacity;','value = queue[front];','front = (front + 1) % capacity;'
    ]);
    const frames=[frame({type:'queue',values,active:[0,values.length-1],circular,deque},circular?'循环队列：front 指向队头，rear 指向下一个可写位置':'front 指向队头，rear 指向队尾之后',0,{front:0,rear:values.length})];
    const enqueued=[...values,77];
    frames.push(frame({type:'queue',values:enqueued,active:[enqueued.length-1],inserted:[enqueued.length-1],circular,deque},deque?'从队尾加入 77':(circular?'77 从队尾入队（rear 模运算前移）':'77 从队尾入队'),0,{front:0,rear:enqueued.length}));
    if(deque){
      const both=[6,...enqueued];
      frames.push(frame({type:'queue',values:both,active:[0],inserted:[0],circular,deque},'双端队列允许从队头加入 6',1));
      both.pop();
      frames.push(frame({type:'queue',values:both,active:[both.length-1],circular,deque},'从队尾删除 77',2));
    } else {
      frames.push(frame({type:'queue',values:enqueued,active:[0],circular,deque},`读取队头元素 ${enqueued[0]}`,2,{front:0}));
      const after=enqueued.slice(1);
      frames.push(frame({type:'queue',values:after,active:[0],circular,deque},circular?'队头元素出队，front 模运算前移':'队头元素出队，front 前移',3,{front:1,rear:enqueued.length}));
      if(circular){
        // 假溢出对比演示（工作流 B）：普通顺序队列 front 前移后数组头部成空洞
        frames.push(meta(frame({type:'queue',values:after,active:[],circular,deque,falseOverflow:true},
          '⚠️ 对比：若这是普通顺序队列，front 前移后头部空位无法复用（rear 已到末尾）→ 假溢出',3),{
          phase:'verify', condition:'普通队列：rear 到末尾后 front 前的空位浪费',
          invariantChecks:['queue-empty-full'], cost:{reads:1}
        }));
      }
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

  /* ============================================================
     矩阵压缩坐标映射公式库（I2-C · 计划书工作流 C）
     kind: 'symmetric-lower' | 'symmetric-upper' | 'triangular' | 'tridiagonal'
     返回 { k, valid, formula }：一维下标、是否落在存储区、映射公式文本
     ============================================================ */
  const MATRIX_MAP = {
    'symmetric-lower': (i, j, n) => {
      const valid = i >= j;
      return { k: valid ? i * (i + 1) / 2 + j : j * (j + 1) / 2 + i, valid: true, formula: 'k = i(i+1)/2 + j（下三角，i ≥ j）' };
    },
    'symmetric-upper': (i, j, n) => {
      const valid = i <= j;
      return { k: valid ? j * (j + 1) / 2 + i : i * (i + 1) / 2 + j, valid: true, formula: 'k = j(j+1)/2 + i（上三角，i ≤ j）' };
    },
    triangular: (i, j, n) => {
      const valid = i >= j;
      return { k: valid ? i * (i + 1) / 2 + j : -1, valid, formula: 'k = i(i+1)/2 + j（下三角；上三角区域保存常量）' };
    },
    tridiagonal: (i, j, n) => {
      const valid = Math.abs(i - j) <= 1;
      return { k: valid ? 2 * i + j : -1, valid, formula: 'k = 2i + j（|i − j| ≤ 1；仅存 3n − 2 个）' };
    }
  };
  window.AlgoraMatrixMap = MATRIX_MAP;
  function matrixMapView(kind, n) {
    // 构造该存储方式下的示例矩阵与压缩存储（对称/三角：下三角区域非零；三对角：带宽 1）
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    let val = 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const keep = kind.startsWith('symmetric') ? true : (kind === 'triangular' ? i >= j : Math.abs(i - j) <= 1);
      if (keep) m[i][j] = val++;
    }
    if (kind.startsWith('symmetric')) {
      // 对称：镜像填充
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) m[i][j] = m[j][i];
    }
    const storage = Array.from({ length: kind === 'tridiagonal' ? 3 * n - 2 : n * (n + 1) / 2 }, () => null);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = MATRIX_MAP[kind](i, j, n);
      if (r.valid) storage[r.k] = m[i][j];
    }
    const spaceBefore = n * n, spaceAfter = storage.length;
    return { kind, n, matrix: m, storage, formula: MATRIX_MAP[kind](0, 0, n).formula, spaceBefore, spaceAfter };
  }

  function matrixTrace(kind) {
    // I2-C：对称/三角/三对角走交互式映射视图（原矩阵 ↔ 公式 ↔ 压缩存储 三联动）
    if (kind === 'symmetric' || kind === 'triangular' || kind === 'tridiagonal') {
      const mapKind = kind === 'symmetric' ? 'symmetric-lower' : kind;
      const n = 4;
      const view = matrixMapView(mapKind, n);
      const code = [
        `// ${view.formula}`,
        'int k = map(i, j, n);',
        'return storage[k];'
      ];
      const labels = {
        'symmetric-lower': '对称矩阵 · 下三角压缩',
        'symmetric-upper': '对称矩阵 · 上三角压缩',
        triangular: '三角矩阵 · 下三角压缩（上三角存常量）',
        tridiagonal: '三对角矩阵 · 仅存 3n−2 个元素'
      };
      const frames = [
        meta(frame({ type: 'matrix-map', ...view, activeCell: null, activeSlot: null }, `${labels[mapKind]}：原矩阵 ${view.spaceBefore} 元素 → 压缩 ${view.spaceAfter} 元素（${(100 * view.spaceAfter / view.spaceBefore).toFixed(0)}%）`, 0), {
          phase: 'init', condition: view.formula,
          invariantChecks: ['graph-consistency'], cost: { reads: 1 }
        }),
        meta(frame({ type: 'matrix-map', ...view, activeCell: [1, 0], activeSlot: MATRIX_MAP[mapKind](1, 0, n).k, formulaText: MATRIX_MAP[mapKind](1, 0, n).formula + ` → a[1][0] 存于 storage[${MATRIX_MAP[mapKind](1, 0, n).k}]` }, `点击矩阵元素 a[1][0]，映射公式 ${MATRIX_MAP[mapKind](1, 0, n).formula}`, 1, { i: 1, j: 0, k: MATRIX_MAP[mapKind](1, 0, n).k }), {
          phase: 'locate', condition: MATRIX_MAP[mapKind](1, 0, n).formula,
          cost: { comparisons: 1, reads: 1 }
        })
      ];
      return { code, frames, interactive: true };
    }
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

    /* ============ I3-A：BST 真实操作（三类删除 + 前驱/后继替换 + 结构验证） ============
       真实 BST 算法驱动：插入 → 查找 → 删除叶 / 删除单孩子 / 删除双孩子（后继替换）
       每帧带 _meta（phase/condition/mutation/invariantChecks/cost），帧末 validateBST */
    const nodes = {}; let rootId = null;
    const frames = [];
    const L = { insert: 0, find: 1, delLeaf: 2, delOne: 3, delTwo: 4, verify: 5 };
    const h = () => null;
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
    function runBstValidator() {
      if (typeof window !== 'undefined' && window.AlgoraValidators && window.AlgoraValidators.validateBST) {
        const vNodes = {};
        Object.values(nodes).forEach((n) => { vNodes[n.id] = { id: n.id, key: n.key, left: n.left, right: n.right, parent: n.parent }; });
        return window.AlgoraValidators.validateBST({ root: rootId, nodes: vNodes });
      }
      return { ok: true, violations: [], degraded: true };
    }
    function insertKey(key) {
      const id = String(key);
      if (!rootId) {
        nodes[id] = { id, key, left: null, right: null, parent: null };
        rootId = id; layout();
        frames.push(meta(frame(snap([id]), `插入 ${key} 作为根结点`, L.insert, { key }), { phase: 'mutate', mutation: { type: 'allocate', targets: [id] }, invariantChecks: ['bst-order'], cost: { reads: 1, writes: 1, allocations: 1 } }));
        return;
      }
      let cur = rootId;
      while (cur) {
        frames.push(meta(frame(snap([cur]), `比较 ${key} 与结点 ${cur}，进入${key < nodes[cur].key ? '左' : '右'}子树`, L.insert, { key, cur: Number(cur) }), { phase: 'locate', condition: `${key} ${key < nodes[cur].key ? '<' : '>'} ${nodes[cur].key}`, cost: { comparisons: 1, reads: 1 } }));
        if (key < nodes[cur].key) { if (!nodes[cur].left) break; cur = nodes[cur].left; }
        else { if (!nodes[cur].right) break; cur = nodes[cur].right; }
      }
      nodes[id] = { id, key, left: null, right: null, parent: cur };
      if (key < nodes[cur].key) nodes[cur].left = id; else nodes[cur].right = id;
      layout();
      frames.push(meta(frame(snap([id]), `结点 ${key} 插入到 ${cur} 的${key < nodes[cur].key ? '左' : '右'}子树`, L.insert, { key }), { phase: 'mutate', mutation: { type: 'insert', targets: [cur, id] }, invariantChecks: ['bst-order'], cost: { reads: 1, writes: 2, allocations: 1 } }));
    }
    function searchKey(key) {
      let cur = rootId; const path = [];
      while (cur && nodes[cur].key !== key) {
        path.push(cur);
        frames.push(meta(frame(snap([cur]), `查找 ${key}：比较 ${key} 与 ${nodes[cur].key}，进入${key < nodes[cur].key ? '左' : '右'}子树`, L.find, { key, cur: Number(cur) }), { phase: 'search', condition: `${key} ${key < nodes[cur].key ? '<' : '>'} ${nodes[cur].key}`, cost: { comparisons: 1, reads: 1 } }));
        cur = key < nodes[cur].key ? nodes[cur].left : nodes[cur].right;
      }
      if (cur) {
        frames.push(meta(frame(snap([cur], { found: [cur] }), `找到结点 ${cur}`, L.find, { result: Number(cur) }), { phase: 'search', condition: `${key} == ${nodes[cur].key}`, cost: { comparisons: 1, reads: 1 } }));
      }
      return cur;
    }
    function successor(id) {
      // 右子树最小结点
      let cur = nodes[id].right;
      if (!cur) return null;
      while (nodes[cur].left) cur = nodes[cur].left;
      return nodes[cur]; // 返回结点对象（含 id/key/parent/right）
    }
    function deleteKey(key) {
      const target = searchKey(key);
      if (!target) return;
      const tid = target;
      const left = nodes[tid].left, right = nodes[tid].right;
      if (!left && !right) {
        // ① 叶结点：直接删除
        frames.push(meta(frame(snap([tid]), `结点 ${tid} 是叶结点（无孩子），直接删除`, L.delLeaf, { key }), { phase: 'mutate', mutation: { type: 'delete', targets: [tid] }, invariantChecks: ['bst-order'], cost: { reads: 1, writes: 1 } }));
        const p = nodes[tid].parent;
        if (p) { if (nodes[p].left === tid) nodes[p].left = null; else nodes[p].right = null; }
        else rootId = null;
        delete nodes[tid]; layout();
      } else if (!left || !right) {
        // ② 单孩子：孩子顶替
        const child = left || right;
        frames.push(meta(frame(snap([tid, child]), `结点 ${tid} 只有${left ? '左' : '右'}孩子 ${child}，孩子直接顶替`, L.delOne, { key }), { phase: 'mutate', mutation: { type: 'delete', targets: [tid, child] }, invariantChecks: ['bst-order'], cost: { reads: 2, writes: 1 } }));
        const p = nodes[tid].parent;
        nodes[child].parent = p;
        if (p) { if (nodes[p].left === tid) nodes[p].left = child; else nodes[p].right = child; }
        else rootId = child;
        delete nodes[tid]; layout();
      } else {
        // ③ 双孩子：后继（右子树最小）替换——只复制值，目标结点保留原 id 与位置
        const succ = successor(tid);
        const succId = succ.id;
        frames.push(meta(frame(snap([tid, succId]), `结点 ${tid} 有两个孩子，选择中序后继 ${succId}（右子树最小）替换`, L.delTwo, { key, successor: Number(succId) }), { phase: 'locate', condition: `后继 = 右子树最左结点 = ${succId}`, mutation: { type: 'read', targets: [succId] }, invariantChecks: ['bst-order'], cost: { comparisons: 1, reads: 2 } }));
        nodes[tid].key = succ.key; // 值覆盖（id 不变，父引用不悬空）
        const sp = succ.parent, sr = succ.right;
        if (sp) {
          if (nodes[sp].left === succId) nodes[sp].left = sr; else nodes[sp].right = sr;
          if (sr) nodes[sr].parent = sp;
        }
        delete nodes[succId]; layout();
        frames.push(meta(frame(snap([tid]), `后继 ${succId} 的值 ${succ.key} 覆盖结点 ${tid}，删除后继结点`, L.delTwo, { key, replacement: succ.key }), { phase: 'repair', mutation: { type: 'delete', targets: [succId] }, invariantChecks: ['bst-order'], cost: { reads: 3, writes: 3 } }));
      }
      // 结构验证
      const res = runBstValidator();
      frames.push(meta(frame(snap([], res.ok ? { success: true } : {}), res.ok ? '✅ 结构验证通过：中序有序' : `⚠️ ${res.violations.map((v) => v.detail).join('；')}`, L.verify), { phase: 'verify', invariantChecks: ['bst-order'], invariantResult: res, cost: { reads: 1 } }));
    }

    // 插入序列 → 查找 50 → 删除三类（叶 10 → 单孩子 20（10 删除后 20 变单孩子）→ 双孩子 40 根）
    values.forEach((k) => insertKey(k));
    searchKey(50);
    deleteKey(10);   // ① 叶结点
    deleteKey(20);   // ② 单孩子（10 已删，20 只有右孩子 30，30 顶替）
    deleteKey(40);   // ③ 双孩子根（后继 50 替换）
    const code = [
      'Node insert(Node root, int x) {',
      '  if (root == null) return new Node(x);',
      '  if (x < root.key) root.left = insert(root.left, x);',
      '  else if (x > root.key) root.right = insert(root.right, x);',
      '  return root;',
      '}',
      '',
      'Node delete(Node root, int key) {',
      '  if (key < root.key) root.left = delete(root.left, key);',
      '  else if (key > root.key) root.right = delete(root.right, key);',
      '  else {',
      '    if (!root.left && !root.right) return null;            // 叶',
      '    if (!root.left) return root.right;                     // 单孩子',
      '    Node s = min(root.right); root.key = s.key;            // 双孩子：后继替换',
      '    root.right = delete(root.right, s.key);',
      '  }',
      '  return root;',
      '}'
    ];
    return { code, frames };
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
    const weights=[5,7,10,15,20,45];
    const code=['put all weights into minHeap;','while (heap.size() > 1) {','  Node a = heap.popMin();','  Node b = heap.popMin();','  heap.push(new Node(a.weight + b.weight, a, b));','}','// 左 0 右 1，从根到叶得到编码'];
    const frames=[];
    // I3-C：真实哈夫曼构建（每步从堆取最小两权值合并）+ 前缀码输出 + WPL
    let nodes=weights.map((w,i)=>({id:'w'+i,weight:w,left:null,right:null}));
    let groups=weights.map((w)=>({w}));
    let mergeCount=0;
    frames.push(meta(frame({type:'huffman',groups,active:[],weights},'全部权值进入最小堆',0),{phase:'init',mutation:{type:'allocate',targets:weights.map((_,i)=>'w'+i)},invariantChecks:['bst-order'],cost:{reads:weights.length}}));
    while(nodes.length>1){
      nodes.sort((a,b)=>a.weight-b.weight);
      const a=nodes.shift(), b=nodes.shift();
      const merged={id:'m'+(++mergeCount),weight:a.weight+b.weight,left:a,right:b};
      // 更新层级展示：剩余集合（a、b 合并为 merged.weight）
      const remaining=weights.slice(); // 简化：直接展示当前堆
      const heapVals=[...nodes.map(n=>n.weight)];
      heapVals.push(merged.weight);
      heapVals.sort((x,y)=>x-y);
      groups=[...heapVals.map((w)=>({w}))];
      frames.push(meta(frame({type:'huffman',groups,active:groups.slice(0,2),weights,mergeStep:`${a.weight} + ${b.weight} = ${merged.weight}`},`从堆取出最小 ${a.weight} 与 ${b.weight}，合并为 ${merged.weight}（左 0 右 1 待编码）`,2,{a:a.weight,b:b.weight,sum:merged.weight}),{phase:'mutate',condition:`a=${a.weight}, b=${b.weight}`,mutation:{type:'merge',targets:[a.id,b.id,merged.id]},invariantChecks:['bst-order'],cost:{comparisons:1,reads:2,writes:1,allocations:1}}));
      nodes.push(merged);
    }
    // 编码：从根 DFS，左 0 右 1
    const root=nodes[0];
    const codes={};
    (function walk(n,prefix){
      if(!n.left&&!n.right){codes[n.id]=prefix;return;}
      if(n.left)walk(n.left,prefix+'0');
      if(n.right)walk(n.right,prefix+'1');
    })(root,'');
    const wpl=weights.reduce((s,w,i)=>s+w*(codes['w'+i]||'').length,0);
    const prefixOk=Object.keys(codes).every((id,i)=>!Object.keys(codes).some((id2,j)=>i!==j&&(codes[id].startsWith(codes[id2])||codes[id2].startsWith(codes[id]))));
    frames.push(meta(frame({type:'huffman',groups:[{w:root.weight}],codes,wpl,weights,success:true},`哈夫曼树构造完成：前缀码性质${prefixOk?'成立 ✓':'被破坏 ✗'}，WPL（带权路径长度）= ${wpl}`,4,{wpl}),{phase:'verify',condition:'前缀码：任何编码不是另一编码的前缀',invariantChecks:['bst-order'],cost:{reads:1}}));
    return {code,frames};
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

  function shortestPathTrace(raw, kind='dijkstra') {
    const graph=parseGraphInput(raw, basicGraph, true) || basicGraph();
    const code=kind==='bellman'?['dist[start] = 0;','repeat V-1 times:','  for each edge (u,v,w)','    if (dist[u]+w < dist[v]) dist[v] = dist[u]+w;','check one more round for negative cycle;']:['dist[start] = 0;','while (unsettled not empty) {','  u = extractMin();','  for (edge u→v) relax(u,v);','}'];
    const edges=graph.edges;
    const start=graph.nodes[0] ? graph.nodes[0].id : 'A';
    const dist={}; graph.nodes.forEach(n=>dist[n.id]=Infinity); dist[start]=0;
    const frames=[frame({type:'graph',...graph,distances:dist,activeNodes:[start],visited:[]},`起点 ${start} 的距离设为 0，其余为 ∞`,0)];
    // I4-C：负权边拒绝（Dijkstra 前提：非负权）
    const negEdges=edges.filter(([u,v,w])=>w<0);
    if(kind==='dijkstra'&&negEdges.length){
      frames.push(meta(frame({type:'graph',...graph,distances:dist,activeNodes:[],activeEdges:negEdges.map(([u,v])=>[u,v]),visited:[]},`⚠️ 检测到 ${negEdges.length} 条负权边（${negEdges.map(([u,v,w])=>`${u}→${v}:${w}`).join('、')}）`,4,{negativeEdges:negEdges.length}),{phase:'verify',condition:'Dijkstra 要求所有边权 ≥ 0',invariantChecks:['graph-consistency'],mutation:{type:'read',targets:[]},cost:{comparisons:negEdges.length}}));
      frames.push(meta(frame({type:'graph',...graph,distances:dist,activeNodes:negEdges.map(([u])=>u),activeEdges:negEdges.map(([u,v])=>[u,v]),visited:[]},'❌ 拒绝执行：Dijkstra 基于贪心「已确定最短路径不再变短」，负权边会破坏该前提（先扩展的路径可能被更短路径超越）。请改用 Bellman-Ford（支持负权，检测负环）。',4),{phase:'verify',condition:'负权边存在 → Dijkstra 不适用',invariantChecks:['graph-consistency'],cost:{reads:1}}));
      return {code,frames};
    }
    if(kind==='bellman'){
      for(let round=1;round<=2;round++) for(const [u,v,w] of edges){for(const [a,b] of [[u,v],[v,u]]){if(dist[a]!==Infinity&&dist[a]+w<dist[b]){dist[b]=dist[a]+w;frames.push(frame({type:'graph',...graph,distances:dist,activeNodes:[a,b],activeEdges:[[a,b]],visited:[]},`第 ${round} 轮：松弛 ${a}→${b}，dist[${b}]=${dist[b]}`,3,{round}));}}}return {code,frames};
    }
    const adj={};graph.nodes.forEach(n=>adj[n.id]=[]);edges.forEach(([u,v,w])=>{adj[u].push([v,w]);adj[v].push([u,w]);});const done=new Set();
    while(done.size<graph.nodes.length){let u=null,best=Infinity;for(const n of graph.nodes)if(!done.has(n.id)&&dist[n.id]<best){best=dist[n.id];u=n.id;}if(u===null)break;done.add(u);frames.push(frame({type:'graph',...graph,distances:dist,activeNodes:[u],visited:[...done]},`确定当前最近顶点 ${u}，距离 ${dist[u]}`,2));for(const [v,w] of adj[u])if(!done.has(v)&&dist[u]+w<dist[v]){dist[v]=dist[u]+w;frames.push(frame({type:'graph',...graph,distances:dist,activeNodes:[u,v],activeEdges:[[u,v]],visited:[...done]},`松弛 ${u}→${v}，新距离 ${dist[v]}`,3));}}
    return {code,frames};
  }

  function floydTrace(raw) {
    const graph=parseGraphInput(raw, basicGraph, true) || basicGraph();
    const labels=graph.nodes.map(n=>n.id).slice(0,6); const n=labels.length; const inf=99; const m=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:inf));
    graph.edges.forEach(([u,v,w])=>{const i=labels.indexOf(u),j=labels.indexOf(v);if(i>=0&&j>=0)m[i][j]=m[j][i]=w;});
    const code=['for (k = 0; k < n; k++)','  for (i = 0; i < n; i++)','    for (j = 0; j < n; j++)','      dist[i][j] = min(dist[i][j], dist[i][k]+dist[k][j]);','// 负环检测：dist[i][i] < 0'];
    const frames=[frame({type:'matrix',matrix:m,labels,active:[]},'初始距离矩阵：无直接边记为 ∞',0)];
    for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(m[i][k]+m[k][j]<m[i][j]){m[i][j]=m[i][k]+m[k][j];frames.push(frame({type:'matrix',matrix:m.map(r=>r.map(v=>v===inf?'∞':v)),labels,active:[[i,j],[i,k],[k,j]],pivot:[k,k]},`允许 ${labels[k]} 作为中间点，更新 ${labels[i]}→${labels[j]} = ${m[i][j]}`,3,{i,j,k}));}
    // I4-C：负环检测
    const negCycle=labels.filter((_,i)=>m[i][i]<0);
    if(negCycle.length){
      const cyc=negCycle.map((v,i)=>`${v} 到自身最短距离 ${m[i][i]} < 0`);
      frames.push(meta(frame({type:'matrix',matrix:m.map(r=>r.map(v=>v===inf?'∞':v)),labels,active:negCycle.map((_,i)=>[i,i]),pivot:null},`⚠️ 检测到负环：${cyc.join('；')} —— 存在总权为负的回路，最短路径无下界`,4),{phase:'verify',condition:'∃ dist[i][i] < 0',invariantChecks:['graph-consistency'],cost:{reads:n}}));
    }
    return {code,frames};
  }

  /* ============================================================
     红黑树插入专属 trace（I4-A · 计划书工作流 D P0）
     真实红黑插入：BST 插入（红）→ 修复循环（叔红变色 / 叔黑旋转）→ 根染黑
     帧末运行 validateRedBlack 验证四条不变量（根黑/红子黑/黑高一致/有序）
     演示序列 [10,20,30,15] 触发 case 1（叔红变色）+ case 2/3（旋转）
     ============================================================ */
  function rbTrace(raw) {
    const keys = safeNums(raw, [10, 20, 30, 15]).slice(0, 6);
    const nodes = {}; let rootId = null; const frames = [];
    const L = { insert: 0, fix: 1, rotate: 2, recolor: 3, verify: 4 };
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
    function rotateLeft(xId) {
      const x = nodes[xId], y = nodes[x.right];
      x.right = y.left; if (y.left) nodes[y.left].parent = xId;
      y.left = xId; y.parent = x.parent; x.parent = y.id;
      if (y.parent == null) rootId = y.id;
      else { const p = nodes[y.parent]; if (p.left === xId) p.left = y.id; else p.right = y.id; }
    }
    function rotateRight(yId) {
      const y = nodes[yId], x = nodes[y.left];
      y.left = x.right; if (x.right) nodes[x.right].parent = yId;
      x.right = yId; x.parent = y.parent; y.parent = x.id;
      if (x.parent == null) rootId = x.id;
      else { const p = nodes[x.parent]; if (p.left === yId) p.left = x.id; else p.right = x.id; }
    }
    function runRbValidator() {
      if (typeof window !== 'undefined' && window.AlgoraValidators && window.AlgoraValidators.validateRedBlack) {
        const vNodes = {};
        Object.values(nodes).forEach((n) => { vNodes[n.id] = { id: n.id, key: n.key, left: n.left, right: n.right, color: n.color }; });
        return window.AlgoraValidators.validateRedBlack({ root: rootId, nodes: vNodes });
      }
      return { ok: true, violations: [], degraded: true };
    }
    function insertRB(key) {
      const id = String(key);
      if (!rootId) {
        nodes[id] = { id, key, left: null, right: null, parent: null, color: 'black' };
        rootId = id; layout();
        frames.push(meta(frame(snap([id]), `插入 ${key} 作为根结点，染为黑色`, L.insert, { key }), { phase: 'mutate', mutation: { type: 'allocate', targets: [id] }, invariantChecks: ['rb-root-black', 'rb-red-child', 'rb-black-height'], cost: { reads: 1, writes: 1, allocations: 1 } }));
        return;
      }
      // BST 插入（新结点默认红色）
      let cur = rootId;
      while (cur) {
        frames.push(meta(frame(snap([cur]), `比较 ${key} 与 ${nodes[cur].key}，进入${key < nodes[cur].key ? '左' : '右'}子树`, L.insert, { key, cur: Number(cur) }), { phase: 'locate', condition: `${key} ${key < nodes[cur].key ? '<' : '>'} ${nodes[cur].key}`, cost: { comparisons: 1, reads: 1 } }));
        if (key < nodes[cur].key) { if (!nodes[cur].left) break; cur = nodes[cur].left; }
        else { if (!nodes[cur].right) break; cur = nodes[cur].right; }
      }
      nodes[id] = { id, key, left: null, right: null, parent: cur, color: 'red' };
      if (key < nodes[cur].key) nodes[cur].left = id; else nodes[cur].right = id;
      layout();
      frames.push(meta(frame(snap([id]), `结点 ${key} 作为红色叶子插入（临时破坏不变量，随后修复）`, L.insert, { key }), { phase: 'mutate', mutation: { type: 'insert', targets: [cur, id] }, invariantChecks: ['rb-red-child'], cost: { reads: 1, writes: 2, allocations: 1 } }));
      // 修复循环
      let z = id, guard = 0;
      while (z !== rootId && nodes[nodes[z].parent].color === 'red' && guard++ < 20) {
        // parent 存的是 id 字符串，先解析为结点对象
        const p = nodes[nodes[z].parent], g = nodes[p.parent]; const isLeftChild = p.left === z;
        if (p.id === g.left) {
          const u = g.right;
          if (u && nodes[u].color === 'red') {
            nodes[p.id].color = 'black'; nodes[u].color = 'black'; g.color = 'red';
            layout();
            frames.push(meta(frame(snap([p.id, u, g.id]), `case 1：叔 ${u} 为红 → 父 ${p.id} 与叔 ${u} 变黑，祖父 ${g.id} 变红`, L.recolor), { phase: 'repair', condition: `叔 ${u} 为红`, mutation: { type: 'recolor', targets: [p.id, u, g.id] }, invariantChecks: ['rb-red-child', 'rb-black-height'], cost: { reads: 3, writes: 3 } }));
            z = g.id;
          } else {
            if (!isLeftChild) {
              const pz = p.id;
              rotateLeft(pz); layout();
              frames.push(meta(frame(snap([pz]), `case 2：${z} 是右孩子 → 对父 ${pz} 左旋`, L.rotate), { phase: 'repair', condition: 'z 为右孩子', mutation: { type: 'rotateLeft', targets: [pz] }, invariantChecks: ['rb-black-height'], cost: { reads: 2, writes: 3 } }));
              z = pz;
            }
            const p2 = nodes[nodes[z].parent], g2 = nodes[p2.parent];
            nodes[p2.id].color = 'black'; g2.color = 'red';
            layout();
            frames.push(meta(frame(snap([p2.id, g2.id]), `case 3：父 ${p2.id} 变黑，祖父 ${g2.id} 变红`, L.recolor), { phase: 'repair', condition: '变色：父黑 祖父红', mutation: { type: 'recolor', targets: [p2.id, g2.id] }, invariantChecks: ['rb-red-child'], cost: { reads: 2, writes: 2 } }));
            const g3 = nodes[p2.parent];
            rotateRight(g3.id); layout();
            frames.push(meta(frame(snap([p2.id]), `case 3：对祖父 ${g3.id} 右旋`, L.rotate), { phase: 'repair', mutation: { type: 'rotateRight', targets: [g3.id] }, invariantChecks: ['rb-red-child', 'rb-black-height'], cost: { reads: 2, writes: 3 } }));
            z = p2.id;
          }
        } else {
          const u = g.left;
          if (u && nodes[u].color === 'red') {
            nodes[p.id].color = 'black'; nodes[u].color = 'black'; g.color = 'red';
            layout();
            frames.push(meta(frame(snap([p.id, u, g.id]), `case 1（镜像）：叔 ${u} 为红 → 父与叔变黑，祖父变红`, L.recolor), { phase: 'repair', condition: `叔 ${u} 为红`, mutation: { type: 'recolor', targets: [p.id, u, g.id] }, invariantChecks: ['rb-red-child', 'rb-black-height'], cost: { reads: 3, writes: 3 } }));
            z = g.id;
          } else {
            if (isLeftChild) {
              const pz = p.id;
              rotateRight(pz); layout();
              frames.push(meta(frame(snap([pz]), `case 2（镜像）：z 是左孩子 → 对父 ${pz} 右旋`, L.rotate), { phase: 'repair', mutation: { type: 'rotateRight', targets: [pz] }, invariantChecks: ['rb-black-height'], cost: { reads: 2, writes: 3 } }));
              z = pz;
            }
            const p2 = nodes[nodes[z].parent], g2 = nodes[p2.parent];
            nodes[p2.id].color = 'black'; g2.color = 'red';
            layout();
            frames.push(meta(frame(snap([p2.id, g2.id]), `case 3（镜像）：父 ${p2.id} 变黑，祖父 ${g2.id} 变红`, L.recolor), { phase: 'repair', mutation: { type: 'recolor', targets: [p2.id, g2.id] }, invariantChecks: ['rb-red-child'], cost: { reads: 2, writes: 2 } }));
            const g3 = nodes[p2.parent];
            rotateLeft(g3.id); layout();
            frames.push(meta(frame(snap([p2.id]), `case 3（镜像）：对祖父 ${g3.id} 左旋`, L.rotate), { phase: 'repair', mutation: { type: 'rotateLeft', targets: [g3.id] }, invariantChecks: ['rb-red-child', 'rb-black-height'], cost: { reads: 2, writes: 3 } }));
            z = p2.id;
          }
        }
      }
      nodes[rootId].color = 'black';
      layout();
      frames.push(meta(frame(snap([rootId]), '修复结束：根结点染黑（不变量恢复）', L.recolor), { phase: 'repair', condition: '根结点为黑', mutation: { type: 'recolor', targets: [rootId] }, invariantChecks: ['rb-root-black', 'rb-red-child', 'rb-black-height'], cost: { reads: 1, writes: 1 } }));
      const res = runRbValidator();
      frames.push(meta(frame(snap([], res.ok ? { success: true } : {}), res.ok ? '✅ 红黑不变量全部满足：根黑 · 红子黑 · 黑高一致 · 中序有序' : `⚠️ ${res.violations.map((v) => v.detail).join('；')}`, L.verify), { phase: 'verify', invariantChecks: ['rb-root-black', 'rb-red-child', 'rb-black-height', 'bst-order'], invariantResult: res, cost: { reads: 1 } }));
    }
    keys.forEach((k) => insertRB(k));
    const code = [
      'rbInsert(root, z) {',
      '  bstInsert(root, z); z.color = RED;',
      '  while (z != root && p(z).color == RED) {',
      '    if (p(z) == left(g(z))) {',
      '      u = right(g(z));',
      '      if (u.color == RED) { p(z).color = u.color = BLACK; g(z).color = RED; z = g(z); }',
      '      else {',
      '        if (z == right(p(z))) { z = p(z); rotateLeft(z); }',
      '        p(z).color = BLACK; g(z).color = RED; rotateRight(g(z));',
      '      }',
      '    } else { /* 镜像 */ }',
      '  }',
      '  root.color = BLACK;',
      '}'
    ];
    return { code, frames };
  }

  /* ============================================================
     2-3 树（B 树 m=3）专属 trace（I4-B · 计划书工作流 D P0）
     插入：叶插入 → 上溢分裂（中关键字上提）；删除：叶删除 → 下溢借位/合并
     帧末运行 validateBTree（阶数/有序/区间/叶同层）
     ============================================================ */
  function btTrace(raw) {
    const keys = safeNums(raw, [10, 20, 30, 40, 50]).slice(0, 7);
    const nodes = {}; let rootId = null; const frames = [];
    let seq = 0;
    const L = { insert: 0, split: 1, delete: 2, borrow: 3, merge: 4, verify: 5 };
    function levels() {
      if (!rootId) return [];
      const out = []; let level = [rootId];
      while (level.length) { out.push(level.map((id) => nodes[id].keys)); level = level.flatMap((id) => nodes[id].children || []); }
      return out;
    }
    function snap(extra) { return { type: 'btree', levels: levels(), ...(extra || {}) }; }
    function runValidator() {
      if (typeof window !== 'undefined' && window.AlgoraValidators && window.AlgoraValidators.validateBTree) {
        return window.AlgoraValidators.validateBTree({ m: 3, root: rootId, nodes });
      }
      return { ok: true, violations: [], degraded: true };
    }
    function splitNode(id) {
      const n = nodes[id];
      const midIdx = 1, mid = n.keys[midIdx];
      const leftId = id; // 原结点复用为左半（keys 收缩回写）
      const rightId = 'n' + (++seq);
      const rightKeys = n.keys.slice(midIdx + 1);
      const leftKids = n.children.length ? n.children.slice(0, midIdx + 1) : [];
      const rightKids = n.children.length ? n.children.slice(midIdx + 1) : [];
      n.keys = n.keys.slice(0, midIdx);
      n.children = leftKids;
      nodes[rightId] = { id: rightId, keys: rightKeys, children: rightKids, parent: n.parent };
      rightKids.forEach((c) => { if (nodes[c]) nodes[c].parent = rightId; });
      if (!n.parent) {
        const newRoot = 'n' + (++seq);
        nodes[newRoot] = { id: newRoot, keys: [mid], children: [leftId, rightId], parent: null };
        nodes[leftId].parent = newRoot; nodes[rightId].parent = newRoot;
        rootId = newRoot;
        return { newRoot, mid, leftId, rightId, parentId: newRoot };
      }
      const p = nodes[n.parent];
      const pIdx = p.children.indexOf(id);
      p.children.splice(pIdx, 1, leftId, rightId);
      const kIdx = p.keys.findIndex((k) => k > mid);
      p.keys.splice(kIdx < 0 ? p.keys.length : kIdx, 0, mid);
      return { parentId: p.id, mid, leftId, rightId };
    }
    function insertKey(key) {
      if (!rootId) {
        nodes['n0'] = { id: 'n0', keys: [key], children: [], parent: null };
        rootId = 'n0';
        frames.push(meta(frame(snap(), `创建根结点，插入关键字 ${key}`, L.insert, { key }), { phase: 'mutate', mutation: { type: 'allocate', targets: ['n0'] }, invariantChecks: ['btree-order', 'btree-degree'], cost: { reads: 1, writes: 1, allocations: 1 } }));
        return;
      }
      let cur = rootId;
      while (nodes[cur].children.length) {
        const kids = nodes[cur].children; let i = 0;
        while (i < nodes[cur].keys.length && key > nodes[cur].keys[i]) i++;
        frames.push(meta(frame(snap(), `查找插入位置：${key} 与结点 [${nodes[cur].keys.join(', ')}] 比较，进入第 ${i + 1} 个子树`, L.insert, { key }), { phase: 'locate', condition: `key=${key}`, cost: { comparisons: 1, reads: 1 } }));
        cur = kids[i];
      }
      const leaf = nodes[cur];
      const pos = leaf.keys.findIndex((k) => key < k);
      leaf.keys.splice(pos < 0 ? leaf.keys.length : pos, 0, key);
      frames.push(meta(frame(snap(), `关键字 ${key} 插入叶子结点 [${leaf.keys.join(', ')}]`, L.insert, { key }), { phase: 'mutate', mutation: { type: 'insert', targets: [cur] }, invariantChecks: ['btree-order', 'btree-degree'], cost: { reads: 1, writes: 2 } }));
      let cur2 = cur;
      while (nodes[cur2].keys.length > 2) {
        const r = splitNode(cur2);
        frames.push(meta(frame(snap(), `结点 [${nodes[cur2].keys.join(', ')}] 关键字数 3 超出上限 2 → 分裂：中关键字 ${r.mid} 上提到父结点`, L.split), { phase: 'repair', condition: 'keys=3 > m-1=2', mutation: { type: 'split', targets: [cur2, r.parentId] }, invariantChecks: ['btree-degree', 'btree-order'], cost: { reads: 3, writes: 3 } }));
        if (r.newRoot) { frames.push(meta(frame(snap(), `根结点分裂，树增高一层（新根 [${r.mid}]）`, L.split), { phase: 'repair', mutation: { type: 'split', targets: [r.newRoot] }, invariantChecks: ['btree-degree'], cost: { reads: 1, writes: 1 } })); break; }
        cur2 = r.parentId;
        if (nodes[cur2].keys.length <= 2) break;
      }
      const res = runValidator();
      frames.push(meta(frame(snap(), res.ok ? '✅ B 树不变量满足：关键字有序 · 阶数合法 · 叶同层' : `⚠️ ${res.violations.map((v) => v.detail).join('；')}`, L.verify), { phase: 'verify', invariantChecks: ['btree-order', 'btree-degree', 'btree-range'], invariantResult: res, cost: { reads: 1 } }));
    }
    function deleteKey(key) {
      let cur = rootId; let found = null;
      while (cur) {
        const n = nodes[cur];
        const ki = n.keys.indexOf(key);
        if (ki >= 0) { found = { node: cur, idx: ki }; break; }
        if (!n.children.length) break;
        let i = 0; while (i < n.keys.length && key > n.keys[i]) i++;
        cur = n.children[i];
      }
      if (!found) return;
      const { node: fid, idx: fIdx } = found;
      const fn = nodes[fid];
      if (fn.children.length) {
        let s = fn.children[fIdx + 1];
        while (nodes[s].children.length) s = nodes[s].children[0];
        fn.keys[fIdx] = nodes[s].keys[0];
        frames.push(meta(frame(snap(), `内部结点删除：用后继 ${nodes[s].keys[0]}（右子树最左叶）替换`, L.delete), { phase: 'mutate', mutation: { type: 'read', targets: [s] }, invariantChecks: ['btree-order'], cost: { reads: 2, writes: 1 } }));
        deleteKey(nodes[s].keys[0]);
        return;
      }
      fn.keys.splice(fIdx, 1);
      frames.push(meta(frame(snap(), `从叶结点删除关键字 ${key}`, L.delete, { key }), { phase: 'mutate', mutation: { type: 'delete', targets: [fid] }, invariantChecks: ['btree-degree'], cost: { reads: 1, writes: 1 } }));
      if (fn.keys.length === 0 && fid !== rootId) {
        const p = nodes[fn.parent];
        const ci = p.children.indexOf(fid);
        const leftSib = ci > 0 ? p.children[ci - 1] : null;
        const rightSib = ci < p.children.length - 1 ? p.children[ci + 1] : null;
        const canBorrow = (sid) => sid && nodes[sid].keys.length > 1;
        if (canBorrow(leftSib) || canBorrow(rightSib)) {
          const sib = canBorrow(leftSib) ? leftSib : rightSib;
          const isLeft = sib === leftSib;
          const sibNode = nodes[sib];
          const sepKey = p.keys[isLeft ? ci - 1 : ci];
          const movedKey = isLeft ? sibNode.keys.pop() : sibNode.keys.shift();
          p.keys[isLeft ? ci - 1 : ci] = movedKey;
          fn.keys.splice(isLeft ? 0 : fn.keys.length, 0, sepKey);
          frames.push(meta(frame(snap(), `下溢修复·借位：兄弟 [${sibNode.keys.join(', ')}] 分给 ${movedKey}，父分隔键 ${sepKey} 下移`, L.borrow), { phase: 'repair', condition: '叶下溢且兄弟可借', mutation: { type: 'split', targets: [sib, fid] }, invariantChecks: ['btree-degree', 'btree-order'], cost: { reads: 3, writes: 3 } }));
        } else {
          const sib = rightSib || leftSib; // 优先右兄弟（保证后续借位演示可发生）
          const isLeft = sib === leftSib;
          const sibNode = nodes[sib];
          const sepKey = p.keys[isLeft ? ci - 1 : ci];
          p.keys.splice(isLeft ? ci - 1 : ci, 1);
          fn.keys = isLeft ? [...sibNode.keys, sepKey] : [sepKey, ...sibNode.keys];
          fn.children = isLeft ? [...sibNode.children, ...fn.children] : [...fn.children, ...sibNode.children];
          fn.children.forEach((c) => { if (nodes[c]) nodes[c].parent = fid; });
          p.children.splice(isLeft ? ci - 1 : ci + 1, 1);
          delete nodes[sib];
          frames.push(meta(frame(snap(), `下溢修复·合并：与兄弟 [${sibNode.keys.join(', ')}] 及父分隔键 ${sepKey} 合并为 [${fn.keys.join(', ')}]`, L.merge), { phase: 'repair', condition: '叶下溢且兄弟不可借', mutation: { type: 'merge', targets: [fid, sib] }, invariantChecks: ['btree-degree', 'btree-order', 'btree-range'], cost: { reads: 3, writes: 3 } }));
        }
      }
      if (rootId && nodes[rootId] && nodes[rootId].keys.length === 0 && nodes[rootId].children.length) {
        rootId = nodes[rootId].children[0];
        nodes[rootId].parent = null;
      }
      const res = runValidator();
      frames.push(meta(frame(snap(), res.ok ? '✅ 删除后 B 树不变量满足' : `⚠️ ${res.violations.map((v) => v.detail).join('；')}`, L.verify), { phase: 'verify', invariantChecks: ['btree-order', 'btree-degree', 'btree-range'], invariantResult: res, cost: { reads: 1 } }));
    }
    keys.forEach((k) => insertKey(k));
    // 删除演示仅在默认输入时执行（自定义输入聚焦插入行为）
    if (!raw || !String(raw).trim()) { deleteKey(30); deleteKey(10); }
    const code = [
      '// B 树（m=3）关键字规则：非根结点 1~2 个，根 1~2 个',
      'insert(key) {',
      '  locate leaf by key order;',
      '  insert key into leaf;',
      '  while (leaf.keys > m-1) split(leaf);   // 上溢分裂',
      '}',
      'delete(key) {',
      '  locate key;',
      '  if internal: replace with successor;',
      '  remove from leaf;',
      '  while (leaf empty) borrow or merge;    // 下溢修复',
      '}'
    ];
    return { code, frames };
  }

  function topoTrace(raw, critical=false) {
    const graph=parseGraphInput(raw, dagGraph, true) || dagGraph();
    const code=critical?['topologicalOrder();','ve[v] = max(ve[v], ve[u] + w);','vl[u] = min(vl[u], vl[v] - w);','if (e(activity) == l(activity)) markCritical();']:['compute indegree[];','push all zero-indegree vertices;','while (!queue.empty()) {','  u = pop(); output(u);','  for (v : adj[u]) if (--indegree[v] == 0) push(v);','}'];
    if(critical){
      const criticalEdges=[['A','B'],['B','E'],['E','F']]; return {code,frames:[
        frame({type:'graph',...graph,activeNodes:['A'],treeEdges:[],distances:{A:0,B:3,C:2,D:5,E:6,F:8}},'正向计算事件最早发生时间 ve',1),
        frame({type:'graph',...graph,activeNodes:['F'],treeEdges:[],distances:{A:0,B:3,C:2,D:5,E:6,F:8}},'逆向计算事件最迟发生时间 vl',2),
        frame({type:'graph',...graph,activeEdges:criticalEdges,treeEdges:criticalEdges,activeNodes:['A','B','E','F']},'活动最早开始时间等于最迟开始时间，构成关键路径 A→B→E→F',3)
      ]};
    }
    // I4-C：Kahn 算法 + 环检测（环证据：从剩余未输出顶点追踪回环）
    const adj={}; graph.nodes.forEach(n=>adj[n.id]=[]);
    graph.edges.forEach(([u,v])=>{adj[u].push(v);});
    const indeg={}; graph.nodes.forEach(n=>{indeg[n.id]=0;});
    graph.edges.forEach(([u,v])=>{indeg[v]=(indeg[v]||0)+1;});
    const queue=graph.nodes.filter(n=>indeg[n.id]===0).map(n=>n.id);
    const order=[],frames=[];
    while(queue.length){
      const u=queue.shift(); order.push(u);
      frames.push(frame({type:'graph',...graph,activeNodes:[u],visited:order,frontier:queue,labels:indeg},`输出入度为 0 的顶点 ${u}`,3));
      for(const v of adj[u]||[]){
        indeg[v]--;
        frames.push(frame({type:'graph',...graph,activeNodes:[u,v],activeEdges:[[u,v]],visited:order,frontier:queue,labels:indeg},`删除边 ${u}→${v}，${v} 的入度减为 ${indeg[v]}`,4));
        if(indeg[v]===0)queue.push(v);
      }
    }
    // 环证据：还有未输出顶点 → 存在环
    if(order.length<graph.nodes.length){
      const remaining=graph.nodes.map(n=>n.id).filter(id=>!order.includes(id));
      // 从第一个剩余顶点沿有向边追踪，找回到自己的环
      const cycle=[];
      let cur=remaining[0]; const seen=new Set();
      while(!seen.has(cur)){
        seen.add(cur); cycle.push(cur);
        const next=(adj[cur]||[]).find(v=>remaining.includes(v));
        if(next===undefined) break;
        cur=next;
      }
      const startIdx=cycle.indexOf(cur);
      const cyclePath=startIdx>=0?[...cycle.slice(startIdx),cur].join('→'):cycle.join('→');
      frames.push(meta(frame({type:'graph',...graph,activeNodes:cycle.filter(v=>remaining.includes(v)),activeEdges:cycle.slice(0,-1).map((v,i)=>[v,cycle[i+1]]).filter(e=>remaining.includes(e[0])&&remaining.includes(e[1])),visited:order,labels:indeg,cyclePath},`⚠️ 检测到环：${cyclePath} —— 有向无环图（DAG）才可拓扑排序，含环时不存在合法拓扑序`,4),{phase:'verify',condition:`剩余 ${remaining.length} 个顶点无法输出（入度均 > 0）`,invariantChecks:['graph-consistency'],cost:{reads:graph.edges.length}}));
    } else {
      frames.push(meta(frame({type:'graph',...graph,activeNodes:[],visited:order,labels:indeg,cyclePath:null},`✅ 全部 ${order.length} 个顶点按拓扑序输出，图无环`,4),{phase:'verify',condition:'输出数 == 顶点数',invariantChecks:['graph-consistency'],cost:{reads:1}}));
    }
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

  // I2-D：排序实验输入集（工作流 F：已排序/逆序/几乎有序/重复/全相等/随机）
  window.SORT_INPUTS = {
    sorted: () => [5, 12, 18, 27, 33, 42, 56, 71],
    reversed: () => [71, 56, 42, 33, 27, 18, 12, 5],
    nearly: () => [5, 12, 27, 18, 33, 42, 56, 71],
    duplicates: () => [18, 5, 18, 27, 5, 42, 18, 5],
    equal: () => [7, 7, 7, 7, 7, 7, 7, 7],
    random: () => Array.from({ length: 8 }, () => 5 + Math.floor(Math.random() * 66))
  };
  window.SORT_INPUT_LABELS = { sorted: '已排序', reversed: '逆序', nearly: '几乎有序', duplicates: '重复值', equal: '全相等', random: '随机' };

  function sortTrace(raw, kind='bubble') {
    const a=safeNums(raw,[42,17,8,33,21,5,29]).slice(0,10); const frames=[];
    // I2-D：操作成本统计（比较/交换/写入），每帧附累计值供实验面板展示
    const stat={comparisons:0,swaps:0,writes:0};
    const ids=a.map((x,idx)=>a.slice(0,idx).filter(v=>v===x).length); // 重复值身份编号（稳定性）
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
    const push=(msg,line,active=[],sorted=[],range=null,extra={})=>{
      const f=frame({type:'bars',values:a,active,sorted,range,stability:ids, ...extra},msg,line);
      f._meta={cost:{...stat}, kind};
      frames.push(f);
    };
    push('初始序列',0);
    if(kind==='bubble'){
      for(let end=a.length-1;end>0;end--){for(let i=0;i<end;i++){stat.comparisons++;push(`比较 ${a[i]} 与 ${a[i+1]}`,1,[i,i+1],Array.from({length:a.length-end-1},(_,k)=>a.length-1-k));if(a[i]>a[i+1]){[a[i],a[i+1]]=[a[i+1],a[i]];stat.swaps++;push('逆序，交换相邻元素',2,[i,i+1],[]);}}push(`位置 ${end} 已确定`,0,[end],Array.from({length:a.length-end},(_,k)=>a.length-1-k));}
    } else if(kind==='insertion'||kind==='binaryInsertion'){
      for(let i=1;i<a.length;i++){const key=a[i];let pos=i;if(kind==='binaryInsertion'){let l=0,r=i-1;while(l<=r){const m=Math.floor((l+r)/2);stat.comparisons++;push(`折半比较 key=${key} 与 a[${m}]=${a[m]}`,1,[m,i],Array.from({length:i},(_,k)=>k),[l,r]);if(a[m]<=key)l=m+1;else r=m-1;}pos=l;}else{while(pos>0&&a[pos-1]>key){stat.comparisons++;pos--;}}
        for(let j=i;j>pos;j--){a[j]=a[j-1];stat.writes++;push(`元素右移，为 ${key} 腾出位置`,2,[j-1,j],Array.from({length:i},(_,k)=>k));}a[pos]=key;push(`将 ${key} 插入位置 ${pos}`,3,[pos],Array.from({length:i+1},(_,k)=>k));}
    } else if(kind==='selection'){
      for(let i=0;i<a.length-1;i++){let min=i;for(let j=i+1;j<a.length;j++){push(`在未排序区间寻找最小值`,2,[min,j],Array.from({length:i},(_,k)=>k));stat.comparisons++;if(a[j]<a[min])min=j;}[a[i],a[min]]=[a[min],a[i]];push(`最小值交换到位置 ${i}`,3,[i,min],Array.from({length:i+1},(_,k)=>k));}
    } else if(kind==='shell'){
      for(let gap=Math.floor(a.length/2);gap>0;gap=Math.floor(gap/2)){for(let i=gap;i<a.length;i++){let temp=a[i],j=i;while(j>=gap&&a[j-gap]>temp){stat.comparisons++;a[j]=a[j-gap];stat.writes++;push(`gap=${gap}：组内元素后移`,2,[j-gap,j],[],null,{gap});j-=gap;}a[j]=temp;push(`gap=${gap}：插入 ${temp}`,2,[j],[],null,{gap});}}
    } else if(kind==='quick'){
      // I3-B：枢轴策略（window.AlgoraSortPivot: last|first|median|random）
      const pivotMode=(typeof window!=='undefined'&&window.AlgoraSortPivot)||'last';
      const quick=(l,r)=>{
        if(l>=r)return;
        let pIdx=r;
        if(pivotMode==='first') pIdx=l;
        else if(pivotMode==='median'){
          const m=Math.floor((l+r)/2);
          const trio=[l,m,r].sort((x,y)=>a[x]-a[y]);
          pIdx=trio[1];
        } else if(pivotMode==='random') pIdx=l+Math.floor(Math.random()*(r-l+1));
        if(pIdx!==r){[a[pIdx],a[r]]=[a[r],a[pIdx]];stat.swaps++;push(`枢轴 ${a[r]} 交换到末尾`,1,[pIdx,r],[],[l,r],{pivot:r});}
        const pivot=a[r];let i=l;
        const modeName={last:'末尾元素',first:'首元素',median:'三数取中',random:'随机'}[pivotMode];
        push(`选择枢轴 ${pivot}（${modeName}）`,1,[r],[],[l,r],{pivot:r});
        for(let j=l;j<r;j++){push(`将 ${a[j]} 与枢轴比较`,1,[j,r],[],[l,r],{pivot:r});if(a[j]<pivot){stat.comparisons++;[a[i],a[j]]=[a[j],a[i]];stat.swaps++;push('较小元素交换到枢轴左侧',1,[i,j],[],[l,r]);i++;}}[a[i],a[r]]=[a[r],a[i]];stat.swaps++;push(`枢轴落位到 ${i}`,1,[i], [i],[l,r],{pivot:i});quick(l,i-1);quick(i+1,r);
      };quick(0,a.length-1);
    } else if(kind==='merge'){
      const mergeSort=(l,r)=>{if(l>=r)return;const m=Math.floor((l+r)/2);mergeSort(l,m);mergeSort(m+1,r);const temp=[];let i=l,j=m+1;while(i<=m&&j<=r){stat.comparisons++;temp.push(a[i]<=a[j]?a[i++]:a[j++]);}while(i<=m)temp.push(a[i++]);while(j<=r)temp.push(a[j++]);for(let k=0;k<temp.length;k++){a[l+k]=temp[k];stat.writes++;}push(`合并区间 [${l}, ${m}] 与 [${m+1}, ${r}]`,3,Array.from({length:r-l+1},(_,k)=>l+k),[],[l,r]);};mergeSort(0,a.length-1);
    } else if(kind==='heap'){
      const sift=(n,i)=>{while(true){let largest=i,l=2*i+1,r=2*i+2;stat.comparisons++;if(l<n&&a[l]>a[largest])largest=l;stat.comparisons++;if(r<n&&a[r]>a[largest])largest=r;if(largest===i)break;[a[i],a[largest]]=[a[largest],a[i]];stat.swaps++;push('下沉调整大根堆',3,[i,largest],[]);i=largest;}};for(let i=Math.floor(a.length/2)-1;i>=0;i--)sift(a.length,i);push('大根堆建立完成',0,[0],[]);for(let end=a.length-1;end>0;end--){[a[0],a[end]]=[a[end],a[0]];stat.swaps++;push('堆顶最大值交换到末尾',2,[0,end],Array.from({length:a.length-end},(_,k)=>a.length-1-k));sift(end,0);}
    } else if(kind==='radix'){
      const max=Math.max(...a);for(let exp=1;Math.floor(max/exp)>0;exp*=10){const buckets=Array.from({length:10},()=>[]);a.forEach(v=>{buckets[Math.floor(v/exp)%10].push(v);stat.writes++;});let k=0;buckets.forEach(bucket=>bucket.forEach(v=>a[k++]=v));push(`按 ${exp===1?'个位':exp===10?'十位':'更高位'} 分配并收集`,1,[],[],null,{buckets,exp});}
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
    if(id==='queue') return queueTrace(rawInput,false,false);
    if(id==='linked-queue') return queueTrace(rawInput,false,false,true);
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
    if(id==='dijkstra') return shortestPathTrace(rawInput,'dijkstra');
    if(id==='floyd') return floydTrace(rawInput);
    if(id==='bellman') return shortestPathTrace(rawInput,'bellman');
    if(id==='topological') return topoTrace(rawInput,false);
    if(id==='critical-path') return topoTrace(rawInput,true);
    if(id==='linear-search') return searchTrace(rawInput,'linear');
    if(id==='ordered-linear-search') return searchTrace(rawInput,'ordered');
    if(id==='binary-search') return searchTrace(rawInput,'binary');
    if(id==='red-black') return rbTrace(rawInput);
    if(id==='b-tree') return btTrace(rawInput);
    if(id==='hash-chain') return hashTrace(rawInput,true);
    if(id==='hash-open') return hashTrace(rawInput,false);
    if(id.endsWith('-sort')){
      const map={'insertion-sort':'insertion','binary-insertion-sort':'binaryInsertion','shell-sort':'shell','bubble-sort':'bubble','quick-sort':'quick','selection-sort':'selection','heap-sort':'heap','merge-sort':'merge','radix-sort':'radix'};
      return sortTrace(rawInput,map[id]);
    }
    return genericTrace(module);
  };
})();
