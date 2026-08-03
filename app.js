(function () {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const modules = window.ALGORA_MODULES;
  const categories = window.ALGORA_CATEGORIES;
  const app = document.getElementById('app');
  const storage = (() => {
    try {
      const probe = '__algora_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    } catch (_) {
      const data = {};
      return { getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); }, removeItem: key => { delete data[key]; } };
    }
  })();

  const state = {
    module: null,
    trace: null,
    index: 0,
    timer: null,
    speed: 800,
    input: '42, 17, 8, 33, 21, 5, 29',
    search: '',
    sidebarOpen: false,
    collapsed: JSON.parse(storage.getItem('algora-collapsed') || '{}'),
    completed: JSON.parse(storage.getItem('algora-completed') || '[]'),
    theme: storage.getItem('algora-theme') || 'light',
    language: storage.getItem('algora-language') || 'java',
    codeBundle: null,
    zoom: 1,
    operation: null,
    operations: []
  };

  function currentModuleFromHash() {
    const id = location.hash.replace('#/','') || 'sequence-list';
    return modules.find(m => m.id === id) || modules[0];
  }

  function randomData() {
    return Array.from({length:7}, () => Math.floor(Math.random()*90)+5).join(', ');
  }

  function renderShell() {
    state.module = currentModuleFromHash();
    state.operations = window.getOperations ? window.getOperations(state.module) : [{id:'algorithm',label:'算法演示'}];
    const savedOperation = storage.getItem('algora-operation-' + state.module.id);
    state.operation = state.operations.some(x=>x.id===savedOperation) ? savedOperation : state.operations[0].id;
    state.trace = window.buildTrace(state.module, state.input, state.operation);
    state.codeBundle = window.getCodeBundle(state.module, state.trace, state.operation);
    if (!state.codeBundle[state.language]) state.language = 'java';
    state.index = 0;
    clearPlayer();
    document.documentElement.dataset.theme = state.theme;
    const category = categories.find(c => c.id === state.module.category);
    const completed = new Set(state.completed);
    const progress = Math.round(completed.size / modules.length * 100);

    app.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <a class="brand" href="#/sequence-list" aria-label="Algora 首页">
            <span class="brand-mark">A</span>
            <span><strong>Algora</strong><small>数据结构 · 动画实验室</small></span>
          </a>
          <div class="top-actions">
            <button class="icon-btn mobile-nav" id="mobile-nav" aria-label="打开导航">☰</button>
            <button class="secondary-btn" id="random-top">生成随机数据</button>
            <button class="icon-btn" id="theme-toggle" aria-label="切换主题">${state.theme==='dark'?'☀':'◐'}</button>
          </div>
        </header>
        <div class="layout">
          ${renderSidebar()}
          <main class="main">
            <div class="breadcrumb">算法实验室 / ${escapeHtml(category.name)} / 当前模块</div>
            <section class="hero">
              <div>
                <h1>${escapeHtml(state.module.title)}</h1>
                <p>${escapeHtml(state.module.summary)}</p>
                <div class="tags">${state.module.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
              </div>
              <aside class="progress-card">
                <strong>学习进度</strong>
                <div class="progress-line"><i style="width:${progress}%"></i></div>
                <small>${completed.size} / ${modules.length} 个模块已标记完成</small>
              </aside>
            </section>
            <section class="workspace">
              <article class="panel animation-panel">
                <div class="panel-head">
                  <div><strong>交互式动画</strong><br><small>图形状态与真实代码逐步同步</small></div>
                  <span class="frame-counter" id="frame-counter">1 / ${state.trace.frames.length}</span>
                </div>
                <div class="operation-tabs" role="tablist" aria-label="结构操作">
                  ${state.operations.map(item=>`<button class="operation-tab ${item.id===state.operation?'active':''}" data-operation="${item.id}" role="tab">${escapeHtml(item.label)}</button>`).join('')}
                </div>
                <div class="control-strip">
                  <input class="dataset-input" id="dataset" value="${escapeHtml(state.input)}" aria-label="输入数据" />
                  <button class="secondary-btn" id="apply-data">应用数据</button>
                  <button class="secondary-btn" id="random-data">随机</button>
                  <select class="speed-select" id="speed" aria-label="动画速度">
                    <option value="1300" ${state.speed===1300?'selected':''}>慢速</option>
                    <option value="800" ${state.speed===800?'selected':''}>正常</option>
                    <option value="350" ${state.speed===350?'selected':''}>快速</option>
                  </select>
                </div>
                <div class="visual-stage" id="visual-stage">
                  <div class="stage-tools" aria-label="画布工具">
                    <button id="zoom-out" title="缩小">−</button>
                    <button id="zoom-in" title="放大">＋</button>
                    <button id="fit-stage" title="恢复比例">1:1</button>
                    <button id="fullscreen-stage" title="全屏">⛶</button>
                  </div>
                  <aside class="variable-box">
                    <strong>主要变量</strong>
                    <div id="variable-list"></div>
                  </aside>
                  <div class="visual-content" id="visual-content"></div>
                  <div class="step-comment">
                    <span>本步注释</span>
                    <strong id="stage-comment"></strong>
                  </div>
                </div>
                <div class="timeline-bar">
                  <div class="timeline-progress"><i id="timeline-fill"></i></div>
                  <input id="timeline" type="range" min="0" max="${Math.max(0,state.trace.frames.length-1)}" value="0" aria-label="动画步骤进度" />
                  <div class="timeline-controls">
                    <span id="timeline-count">1 / ${state.trace.frames.length}</span>
                    <div class="player">
                      <button id="reset-step" title="重置">⟲</button>
                      <button id="prev-step" title="上一步">‹</button>
                      <button class="play-primary" id="play-step" title="播放">▶ 播放</button>
                      <button id="next-step" title="下一步">›</button>
                    </div>
                  </div>
                </div>
                <div class="message-bar">
                  <div class="message-main"><span class="step-badge" id="step-badge">1</span><div class="message-text" id="message-text"></div></div>
                  <div class="message-vars" id="message-vars"></div>
                  <div class="frame-meta" id="frame-meta" hidden></div>
                </div>
              </article>
              <article class="panel code-panel">
                <div class="code-panel-head">
                  <div class="code-tabs" role="tablist" aria-label="代码语言">
                    ${Object.values(state.codeBundle).map(lang=>`<button class="code-tab ${lang.id===state.language?'active':''}" data-language="${lang.id}" role="tab">${escapeHtml(lang.label)}</button>`).join('')}
                  </div>
                  <span class="code-standard" id="code-standard"></span>
                </div>
                <div class="code-status"><span>当前执行代码</span><strong id="code-step-label">步骤 1</strong></div>
                <div class="code-wrap" id="code-wrap"></div>
                <div class="complexity">
                  <div class="metric"><small>时间复杂度</small><strong>${escapeHtml(state.module.time)}</strong></div>
                  <div class="metric"><small>空间复杂度</small><strong>${escapeHtml(state.module.space)}</strong></div>
                </div>
              </article>
            </section>
            ${renderLearningCards()}
          </main>
        </div>
      </div>`;
    bindEvents();
    renderFrame();
  }

  function renderSidebar() {
    const q = state.search.trim().toLowerCase();
    let hasAny = false;
    const groups = categories.map(cat => {
      const items = modules.filter(m => m.category===cat.id && (!q || `${m.title} ${m.tags.join(' ')}`.toLowerCase().includes(q)));
      if (!items.length) return '';
      hasAny = true;
      const collapsed = !!state.collapsed[cat.id] && !q;
      return `<section class="category">
        <button class="category-title" data-category="${cat.id}"><span><i class="category-icon">${cat.icon}</i>${escapeHtml(cat.name)}</span><span>${collapsed?'＋':'−'}</span></button>
        <div class="category-list" style="display:${collapsed?'none':'grid'}">
          ${items.map(m=>`<a class="nav-item ${m.id===state.module?.id?'active':''}" href="#/${m.id}">${escapeHtml(m.title)}</a>`).join('')}
        </div>
      </section>`;
    }).join('');
    return `<aside class="sidebar ${state.sidebarOpen?'open':''}" id="sidebar">
      <div class="search-wrap"><span class="search-icon">⌕</span><input id="nav-search" value="${escapeHtml(state.search)}" placeholder="搜索算法或数据结构" /></div>
      ${renderMaturityBar()}
      <nav id="nav-groups">${hasAny?groups:'<div class="empty-search">未找到匹配模块</div>'}</nav>
    </aside>`;
  }

  // 内容成熟度统计条（计划书第 8 项：展示真实成熟度而非只显示总数）
  function renderMaturityBar() {
    const count = { L1: 0, L2: 0, L3: 0, L4: 0 };
    modules.forEach((m) => { count[m.level || 'L1']++; });
    const total = modules.length || 1;
    const names = { L1: '概览', L2: '标准', L3: '精讲', L4: '实验' };
    const rows = ['L1', 'L2', 'L3', 'L4'].map((lv) => {
      const n = count[lv];
      const pct = Math.round((n / total) * 100);
      return `<div class="maturity-row" title="${names[lv]}：${n} 个模块">
        <span class="m-level m-${lv}">${lv}</span>
        <span class="m-name">${names[lv]}</span>
        <div class="m-track"><i style="width:${pct}%"></i></div>
        <span class="m-num">${n}</span>
      </div>`;
    }).join('');
    return `<div class="maturity-bar" id="maturityBar">
      <div class="maturity-head">内容成熟度 · 共 ${modules.length} 模块</div>
      ${rows}
    </div>`;
  }

  function renderLearningCards() {
    const tips = tipsFor(state.module);
    return `<section class="info-grid">
      <article class="info-card"><h3>核心机制</h3><p>${escapeHtml(tips.mechanism)}</p></article>
      <article class="info-card"><h3>观察重点</h3><ul class="info-list">${tips.observe.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></article>
      <article class="info-card"><h3>常见易错点</h3><ul class="info-list">${tips.errors.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></article>
    </section>
    <section class="quiz-card">
      <h3>一分钟自测</h3>
      <p>${escapeHtml(tips.question)}</p>
      <div class="quiz-options">${tips.options.map((o,i)=>`<button class="quiz-option" data-answer="${i}">${escapeHtml(o)}</button>`).join('')}</div>
      <div class="quiz-feedback" id="quiz-feedback"></div>
      <button class="primary-btn" id="mark-complete">${state.completed.includes(state.module.id)?'✓ 已完成':'标记本模块为已完成'}</button>
    </section>`;
  }

  function tipsFor(m) {
    const base = {
      mechanism: m.summary,
      observe: ['关注高亮元素与指针/区间的变化', '比较每一步对应的代码行', `结合复杂度：${m.time}`],
      errors: ['忽略空结构和边界位置', '混淆逻辑结构与物理存储', '只记结论，不跟踪状态变化'],
      question: `关于“${m.title}”，下列哪一项最符合其复杂度特征？`,
      options: [m.time, '所有操作恒为 O(1)', '空间复杂度恒为 O(1)'],
      answer: 0
    };
    if (m.category==='sort') {
      base.mechanism='排序动画把“比较、移动、交换、区间缩小”拆成可观察状态。';
      base.observe=['高亮柱表示当前比较或交换对象','绿色柱表示位置已经确定','注意稳定性与额外空间需求'];
      base.errors=['把比较次数和移动次数混为一谈','忽略最好、平均和最坏情况','错误判断稳定性'];
    } else if (m.category==='graph') {
      base.mechanism='图算法通常围绕访问集合、候选边和距离/入度等辅助状态推进。';
      base.observe=['区分已确定顶点与候选顶点','观察边何时被选择、松弛或舍弃','明确算法对负权、连通性或有向性的要求'];
      base.errors=['重复访问顶点','忘记初始化无穷距离或入度','将最短路径树与最小生成树混淆'];
    } else if (m.category==='tree') {
      base.observe=['跟踪父子关系与递归返回顺序','观察旋转前后的中序序列是否保持','区分树高与结点数量'];
    }
    return base;
  }

  function bindEvents() {
    $('#theme-toggle').onclick = () => {
      state.theme = state.theme==='dark'?'light':'dark';
      storage.setItem('algora-theme', state.theme);
      document.documentElement.dataset.theme = state.theme;
      $('#theme-toggle').textContent = state.theme==='dark'?'☀':'◐';
    };
    $('#mobile-nav').onclick = () => { state.sidebarOpen = !state.sidebarOpen; $('#sidebar').classList.toggle('open',state.sidebarOpen); };
    $('#random-top').onclick = () => applyRandom();
    $('#random-data').onclick = () => applyRandom();
    $('#apply-data').onclick = () => rebuildTrace($('#dataset').value);
    $('#dataset').addEventListener('keydown',e=>{if(e.key==='Enter') rebuildTrace(e.target.value);});
    $('#prev-step').onclick = () => step(-1);
    $('#next-step').onclick = () => step(1);
    $('#play-step').onclick = togglePlayer;
    $('#reset-step').onclick = () => { clearPlayer(); state.index=0; renderFrame(); };
    $('#speed').onchange = e => { state.speed=Number(e.target.value); if(state.timer){clearPlayer();togglePlayer();} };
    $$('.operation-tab').forEach(btn=>btn.onclick=()=>{
      clearPlayer();
      state.operation=btn.dataset.operation;
      storage.setItem('algora-operation-' + state.module.id,state.operation);
      state.trace=window.buildTrace(state.module,state.input,state.operation);
      state.codeBundle=window.getCodeBundle(state.module,state.trace,state.operation);
      state.index=0;
      $$('.operation-tab').forEach(tab=>tab.classList.toggle('active',tab===btn));
      $('#frame-counter').textContent=`1 / ${state.trace.frames.length}`;
      $('#timeline').max=Math.max(0,state.trace.frames.length-1);
      renderFrame();
    });
    $$('.code-tab').forEach(btn=>btn.onclick=()=>{
      state.language=btn.dataset.language;
      storage.setItem('algora-language',state.language);
      $$('.code-tab').forEach(tab=>tab.classList.toggle('active',tab===btn));
      renderFrame();
    });
    $('#timeline').oninput = e => { clearPlayer(); state.index=Number(e.target.value); renderFrame(); };
    $('#zoom-out').onclick = () => setZoom(state.zoom - .1);
    $('#zoom-in').onclick = () => setZoom(state.zoom + .1);
    $('#fit-stage').onclick = () => setZoom(1);
    $('#fullscreen-stage').onclick = () => {
      const stage=$('#visual-stage');
      if(document.fullscreenElement) document.exitFullscreen?.(); else stage.requestFullscreen?.();
    };
    $('#nav-search').oninput = e => {
      state.search=e.target.value;
      const sidebar=$('#sidebar');
      const scroll=sidebar.scrollTop;
      const temp=document.createElement('div');
      const oldGroups=$('#nav-groups');
      const rendered=renderSidebar();
      temp.innerHTML=rendered;
      oldGroups.replaceWith($('#nav-groups',temp));
      sidebar.scrollTop=scroll;
      bindSidebarEvents();
    };
    bindSidebarEvents();
    $$('.quiz-option').forEach(btn=>btn.onclick=()=>answerQuiz(btn));
    $('#mark-complete').onclick = toggleComplete;
  }

  function bindSidebarEvents() {
    $$('.category-title').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.category;
      state.collapsed[id]=!state.collapsed[id];
      storage.setItem('algora-collapsed',JSON.stringify(state.collapsed));
      const list=btn.nextElementSibling;
      list.style.display=state.collapsed[id]?'none':'grid';
      btn.lastElementChild.textContent=state.collapsed[id]?'＋':'−';
    });
    $$('.nav-item').forEach(link=>link.onclick=()=>{state.sidebarOpen=false;clearPlayer();});
  }

  function applyRandom() {
    const data=randomData();
    $('#dataset').value=data;
    rebuildTrace(data);
  }

  function rebuildTrace(value) {
    state.input=value;
    state.trace=window.buildTrace(state.module,state.input,state.operation);
    state.codeBundle=window.getCodeBundle(state.module,state.trace,state.operation);
    state.index=0;
    clearPlayer();
    renderFrame();
  }

  function step(delta) {
    clearPlayer();
    state.index=Math.max(0,Math.min(state.trace.frames.length-1,state.index+delta));
    renderFrame();
  }

  function togglePlayer() {
    if(state.timer){clearPlayer();return;}
    $('#play-step').textContent='Ⅱ 暂停';
    state.timer=setInterval(()=>{
      if(state.index>=state.trace.frames.length-1){clearPlayer();return;}
      state.index++;renderFrame();
    },state.speed);
  }

  function clearPlayer() {
    if(state.timer) clearInterval(state.timer);
    state.timer=null;
    const btn=$('#play-step'); if(btn) btn.textContent='▶ 播放';
  }

  function renderFrame() {
    const f=state.trace.frames[state.index];
    const language=state.codeBundle[state.language] || state.codeBundle.java;
    const activeLines=language.anchors[f.line] || [Math.min(f.line,language.lines.length-1)];
    const progress=state.trace.frames.length<=1?100:(state.index/(state.trace.frames.length-1))*100;
    $('#visual-content').innerHTML=renderVisual(f.visual,f.vars||{});
    $('#visual-content').style.transform=`scale(${state.zoom})`;
    $('#message-text').textContent=f.message;
    $('#stage-comment').textContent=f.message;
    $('#step-badge').textContent=state.index+1;
    $('#frame-counter').textContent=`${state.index+1} / ${state.trace.frames.length}`;
    $('#timeline-count').textContent=`${state.index+1} / ${state.trace.frames.length}`;
    $('#code-step-label').textContent=`步骤 ${state.index+1} · 源轨迹行 ${f.line+1}`;
    $('#code-standard').textContent=language.standard;
    $('#timeline').max=Math.max(0,state.trace.frames.length-1);
    $('#timeline').value=state.index;
    $('#timeline-fill').style.width=`${progress}%`;
    const variables=collectVariables(f);
    $('#variable-list').innerHTML=variables.map(([k,v])=>`<div class="variable-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(formatVariable(v))}</strong></div>`).join('') || '<div class="variable-empty">当前步骤无显式变量</div>';
    $('#message-vars').textContent=variables.map(([k,v])=>`${k}=${formatVariable(v)}`).join('  ');
    renderFrameMeta(f);
    $('#code-wrap').innerHTML=language.lines.map((line,i)=>`<div class="code-line ${activeLines.includes(i)?'active':''}" data-line="${i}"><span class="line-number">${i+1}</span><code>${highlightCode(line,state.language)}</code></div>`).join('');
    const active=$('.code-line.active'); const codeWrap=$('#code-wrap');
    if(active && codeWrap) codeWrap.scrollTo({top:Math.max(0,active.offsetTop-codeWrap.clientHeight/2),behavior:'smooth'});
    $('#prev-step').disabled=state.index===0;
    $('#reset-step').disabled=state.index===0;
    $('#next-step').disabled=state.index===state.trace.frames.length-1;
  }

  // 帧语义信息条（I1-A：phase / condition / mutation / invariantChecks / cost / 验证结果）
  const PHASE_LABEL = { locate: '定位', mutate: '修改', repair: '修复', verify: '验证', init: '初始化', cleanup: '收尾' };
  const MUTATION_LABEL = { rotateRight: '右旋', rotateLeft: '左旋', rotate: '旋转', 'double-rotate': '双旋', insert: '插入', allocate: '分配', delete: '删除', swap: '交换', write: '写入' };
  function renderFrameMeta(f) {
    const box = $('#frame-meta');
    if (!box) return;
    const m = f._meta;
    if (!m) { box.hidden = true; box.innerHTML = ''; return; }
    const chips = [];
    if (m.phase) chips.push(`<span class="fm-chip fm-phase">阶段：${PHASE_LABEL[m.phase] || m.phase}</span>`);
    if (m.condition) chips.push(`<span class="fm-chip fm-cond">判断：${escapeHtml(m.condition)}</span>`);
    if (m.mutation && m.mutation.type) chips.push(`<span class="fm-chip fm-mut">操作：${MUTATION_LABEL[m.mutation.type] || m.mutation.type}${m.mutation.targets ? ' → ' + m.mutation.targets.join(', ') : ''}</span>`);
    if (m.invariantChecks && m.invariantChecks.length) chips.push(`<span class="fm-chip fm-inv">不变量：${m.invariantChecks.join(' · ')}</span>`);
    if (m.cost) {
      const c = m.cost;
      const parts = [];
      if (c.comparisons) parts.push(`比较 ${c.comparisons}`);
      if (c.reads) parts.push(`读 ${c.reads}`);
      if (c.writes) parts.push(`写 ${c.writes}`);
      if (c.swaps) parts.push(`交换 ${c.swaps}`);
      if (c.allocations) parts.push(`分配 ${c.allocations}`);
      if (parts.length) chips.push(`<span class="fm-chip fm-cost">成本：${parts.join(' · ')}</span>`);
    }
    if (f._meta.invariantResult) {
      const r = f._meta.invariantResult;
      chips.push(r.ok
        ? `<span class="fm-chip fm-result ok">结构验证：通过 ✓</span>`
        : `<span class="fm-chip fm-result bad">结构验证：破坏 ✗ ${escapeHtml(r.violations.map(v => v.detail).join('；'))}</span>`);
    }
    if (chips.length) { box.innerHTML = chips.join(''); box.hidden = false; }
    else { box.hidden = true; box.innerHTML = ''; }
  }

  function collectVariables(frame) {
    const entries=[];
    const merged={...(frame.visual?.pointers||{}),...(frame.vars||{})};
    if(frame.visual?.values && merged.length===undefined && ['array','queue','stack'].includes(frame.visual.type)) merged.length=frame.visual.values.length;
    Object.entries(merged).forEach(([key,value])=>{
      if(value!==undefined && value!==null && !entries.some(([k])=>k===key)) entries.push([key,value]);
    });
    return entries.slice(0,8);
  }

  function formatVariable(value) {
    if(Array.isArray(value)) return `[${value.join(', ')}]`;
    if(value===Infinity) return '∞';
    if(typeof value==='object') return JSON.stringify(value);
    return String(value);
  }

  function setZoom(next) {
    state.zoom=Math.max(.65,Math.min(1.55,Number(next.toFixed(2))));
    const visual=$('#visual-content');
    if(visual) visual.style.transform=`scale(${state.zoom})`;
    const fit=$('#fit-stage');
    if(fit) fit.textContent=`${Math.round(state.zoom*100)}%`;
  }

  function highlightCode(line, language) {
    let source=String(line);
    const commentStart=language==='python'?source.indexOf('#'):source.indexOf('//');
    let comment='';
    if(commentStart>=0){comment=source.slice(commentStart);source=source.slice(0,commentStart);}
    let s=escapeHtml(source);
    const keywords=language==='python'
      ? /\b(def|class|if|elif|else|for|while|in|return|True|False|None|from|import|raise|and|or|not|is|lambda)\b/g
      : /\b(public|private|protected|static|final|class|struct|record|enum|void|int|long|double|boolean|bool|char|auto|const|if|else|for|while|return|new|true|false|nullptr|null|throw|using|include)\b/g;
    s=s.replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g,'<span class="str">$1</span>');
    s=s.replace(keywords,'<span class="kw">$1</span>');
    s=s.replace(/\b([A-Za-z_]\w*)\s*(?=\()/g,'<span class="fn">$1</span>');
    s=s.replace(/\b(\d+)\b/g,'<span class="numlit">$1</span>');
    return s+(comment?`<span class="comment">${escapeHtml(comment)}</span>`:'');
  }

  function renderVisual(v, vars={}) {
    if(!v) return '';
    const renderers={array:renderArray,bars:renderBars,linked:renderLinked,'static-list':renderStaticList,stack:renderStack,queue:renderQueue,bracket:renderBracket,expression:renderExpression,matrix:renderMatrix,string:renderString,tree:renderTree,graph:renderGraph,btree:renderBTree,huffman:renderHuffman,hash:renderHash};
    return (renderers[v.type]||renderArray)(v,vars);
  }

  function classFor(i,v) {
    return [v.active?.includes(i)?'active':'',v.inserted?.includes(i)?'inserted':'',v.moved?.includes(i)?'moved':'',v.found?.includes(i)?'found':''].filter(Boolean).join(' ');
  }

  function renderArray(v, vars={}) {
    const vals=v.values||[];
    const pointerData={...(v.pointers||{}),...vars};
    const indexKeys=new Set(['i','j','pos','left','mid','right','front','rear','pivot','min','end']);
    const cells=vals.map((x,i)=>{
      const labels=Object.entries(pointerData).filter(([k,val])=>indexKeys.has(k)&&Number(val)===i).map(([k])=>k);
      return `<div class="cell-wrap pointer-cell">${labels.length?`<div class="pointer-arrows">${labels.map(k=>`<span><b>${escapeHtml(k)}</b><i>▼</i></span>`).join('')}</div>`:''}<div class="array-cell ${classFor(i,v)}">${x===null?'∅':escapeHtml(x)}</div><span class="cell-index">${i}</span></div>`;
    }).join('');
    const scalarPointers=Object.entries(pointerData).filter(([k])=>!indexKeys.has(k)).map(([k,val])=>`<span class="pointer-pill">${escapeHtml(k)} = ${escapeHtml(formatVariable(val))}</span>`).join('');
    return `<div class="array-visual">${cells}</div>${v.range?`<div class="pointer-labels"><span class="pointer-pill">搜索区间 [${v.range[0]}, ${v.range[1]}]</span></div>`:''}<div class="pointer-labels">${scalarPointers}</div>`;
  }

  function renderBars(v) {
    const max=Math.max(...v.values,1);
    const bars=v.values.map((x,i)=>`<div class="bar-wrap"><div class="bar ${v.active?.includes(i)?'active':''} ${v.sorted?.includes(i)?'sorted':''}" style="height:${45+x/max*210}px">${x}</div><div class="bar-index">${i}</div></div>`).join('');
    let buckets='';
    if(v.buckets) buckets=`<div class="bucket-line">${v.buckets.map((b,i)=>`<div class="bucket">${i}: ${b.join(', ')||'—'}</div>`).join('')}</div>`;
    return `<div class="bars-visual">${bars}</div>${buckets}${v.gap?`<div class="pointer-labels"><span class="pointer-pill">gap = ${v.gap}</span></div>`:''}`;
  }

  function renderLinked(v) {
    const node=(value,i,extra='')=>{
      const cls=`node ${v.doubly?'double':''} ${v.active?.includes(i)?'active':''} ${v.inserted?.includes(i)?'inserted':''}`;
      if(v.doubly) return `<div class="${cls}"><span class="node-pointer">←</span><span class="node-value">${escapeHtml(value)}</span><span class="node-pointer">→</span></div>`;
      return `<div class="${cls}"><span class="node-value">${escapeHtml(value)}</span><span class="node-pointer">→</span></div>`;
    };
    const floating=v.floating!==undefined?`<div class="floating-node">${node(v.floating,-1)}</div>`:'';
    const row=(v.values||[]).map((x,i)=>`${node(x,i)}${i<v.values.length-1?'<span class="arrow">→</span>':''}`).join('');
    return `${floating}<div class="linked-visual">${row}${v.circular?'<span class="arrow">↩</span>':'<span class="pointer-pill">NULL</span>'}</div>${v.circular?'<div class="circular-note">尾结点重新连接到首结点</div>':''}`;
  }

  function renderStaticList(v) {
    return `<table class="static-table"><thead><tr><th>下标</th><th>data</th><th>next</th></tr></thead><tbody>${v.slots.map(s=>`<tr class="${v.active?.includes(s.index)?'active':''}"><td>${s.index}</td><td>${s.value??'空闲'}</td><td>${s.next}</td></tr>`).join('')}</tbody></table><div class="pointer-labels"><span class="pointer-pill">访问序列：${(v.order||[]).join(' → ')||'—'}</span></div>`;
  }

  function renderStack(v) {
    return `<div class="stack-visual">${(v.values||[]).map((x,i)=>`<div class="stack-cell ${v.active?.includes(i)?'active':''}">${escapeHtml(x)}${i===v.values.length-1?' · top':''}</div>`).join('')}<div class="stack-base"></div></div>`;
  }

  function renderQueue(v) {
    const cells=(v.values||[]).map((x,i)=>`<div class="cell-wrap"><div class="queue-cell ${classFor(i,v)}">${escapeHtml(x)}</div><span class="cell-index">${i===0?'front':i===v.values.length-1?'rear':''}</span></div>`).join('');
    return `<div class="queue-visual">${v.circular?'<span class="arrow">↻</span>':''}${cells}${v.circular?'<span class="arrow">↺</span>':''}</div>`;
  }

  function renderBracket(v) {
    return `<div class="bracket-text">${[...v.text].map((c,i)=>`<div class="char-cell ${i===v.index?'active':''}">${escapeHtml(c)}</div>`).join('')}</div><div class="mini-stack-row"><div class="mini-stack"><strong>匹配栈</strong><div class="mini-items">${(v.stack||[]).map(x=>`<span class="mini-item">${escapeHtml(x)}</span>`).join('')||'空'}</div></div></div>`;
  }

  function renderExpression(v) {
    return `<div class="expression-text">${[...v.expr].map((c,i)=>`<div class="char-cell ${i===v.index?'active':''}">${c===' '?'·':escapeHtml(c)}</div>`).join('')}</div><div class="mini-stack-row"><div class="mini-stack"><strong>操作数栈</strong><div class="mini-items">${v.numbers.map(x=>`<span class="mini-item">${x}</span>`).join('')}</div></div><div class="mini-stack"><strong>运算符栈</strong><div class="mini-items">${v.operators.map(x=>`<span class="mini-item">${x}</span>`).join('')||'空'}</div></div></div>`;
  }

  function renderMatrix(v) {
    const labels=v.labels||[];
    const rows=v.matrix.map((row,i)=>`<tr>${labels.length?`<th>${labels[i]}</th>`:''}${row.map((x,j)=>`<td class="${v.active?.some(c=>c[0]===i&&c[1]===j)?'active':''}">${x===99?'∞':escapeHtml(x)}</td>`).join('')}</tr>`).join('');
    const head=labels.length?`<tr><th></th>${labels.map(x=>`<th>${x}</th>`).join('')}</tr>`:'';
    const storage=(v.storage||[]).map(x=>`<span class="storage-item">(${x.r}, ${x.col}, ${x.value})</span>`).join('');
    return `<div class="matrix-wrap"><table class="matrix-table">${head}${rows}</table>${storage?`<div><strong>压缩结果</strong><div class="storage-list">${storage}</div></div>`:''}</div>`;
  }

  function renderString(v) {
    const text=[...v.text].map((c,i)=>`<div class="char-cell ${i===v.textIndex?'active':''} ${i===v.textIndex?(v.ok?'ok':'bad'):''}">${c}</div>`).join('');
    const pattern=[...v.pattern].map((c,i)=>`<div class="char-cell ${i===v.patternIndex?'active':''} ${i===v.patternIndex?(v.ok?'ok':'bad'):''}">${c}</div>`).join('');
    return `<div class="string-visual"><div class="string-row">${text}</div><div class="string-row pattern-row" style="transform:translateX(${(v.offset||0)*50}px)">${pattern}</div>${v.next?`<div class="next-row">next = [${v.next.join(', ')}]</div>`:''}</div>`;
  }

  function lineStyle(a,b) {
    const dx=b.x-a.x,dy=b.y-a.y; const len=Math.sqrt(dx*dx+dy*dy); const angle=Math.atan2(dy,dx)*180/Math.PI;
    return `left:${a.x}%;top:${a.y}%;width:${len}%;transform:rotate(${angle}deg)`;
  }

  function renderTree(v) {
    const nodes=v.nodes||[]; const map=Object.fromEntries(nodes.map(n=>[n.id,n]));
    const edges=nodes.filter(n=>n.parent&&map[n.parent]).map(n=>`<div class="tree-edge" style="${lineStyle(map[n.parent],n)}"></div>`).join('');
    const html=nodes.map(n=>`<div class="tree-node ${v.active?.includes(n.id)?'active':''} ${v.visited?.includes(n.id)?'visited':''} ${n.color||''}" style="left:${n.x}%;top:${n.y}%">${escapeHtml(n.id)}</div>`).join('');
    const queue=v.queue?.length?`<div class="graph-side-data"><span class="graph-data-card">队列：${v.queue.join(' → ')}</span></div>`:'';
    return `<div class="tree-canvas">${edges}${html}</div>${queue}`;
  }

  function renderGraph(v) {
    const visible=v.builtEdges||v.edges||[]; const nodeMap=Object.fromEntries(v.nodes.map(n=>[n.id,n]));
    const activeEdge=(u,w)=>(v.activeEdges||[]).some(e=>(e[0]===u&&e[1]===w)||(e[0]===w&&e[1]===u));
    const treeEdge=(u,w)=>(v.treeEdges||[]).some(e=>(e[0]===u&&e[1]===w)||(e[0]===w&&e[1]===u));
    const rejected=(u,w)=>(v.rejectedEdges||[]).some(e=>(e[0]===u&&e[1]===w)||(e[0]===w&&e[1]===u));
    const edges=visible.map(([u,w,weight])=>{const a=nodeMap[u],b=nodeMap[w];if(!a||!b)return'';const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;return `<div class="graph-edge ${activeEdge(u,w)?'active':''} ${treeEdge(u,w)?'tree':''} ${rejected(u,w)?'rejected':''}" style="${lineStyle(a,b)}"></div><span class="edge-label" style="left:${mx}%;top:${my}%">${weight}</span>`;}).join('');
    const nodes=v.nodes.map(n=>`<div class="graph-node ${v.activeNodes?.includes(n.id)?'active':''} ${v.visited?.includes(n.id)?'visited':''}" style="left:${n.x}%;top:${n.y}%">${n.id}${v.distances&&v.distances[n.id]!==undefined?`<span class="node-label">d=${v.distances[n.id]===null||v.distances[n.id]===Infinity?'∞':v.distances[n.id]}</span>`:''}${v.labels&&v.labels[n.id]!==undefined?`<span class="node-label">in=${v.labels[n.id]}</span>`:''}</div>`).join('');
    const data=[];if(v.frontier?.length)data.push(`候选：${v.frontier.join(' → ')}`);if(v.showList)data.push('邻接表：A→B,F · B→A,C,F,E');if(v.showMatrix)data.push('邻接矩阵：有边位置记录权值');
    return `<div class="graph-canvas">${edges}${nodes}</div>${data.length?`<div class="graph-side-data">${data.map(x=>`<span class="graph-data-card">${x}</span>`).join('')}</div>`:''}`;
  }

  function renderBTree(v) {
    return `<div class="btree-visual">${v.levels.map((level,li)=>`<div class="btree-level">${level.map((keys,ki)=>`<div class="btree-node ${(v.active==='root'&&li===0)?'active':''}">${keys.map(k=>`<span class="btree-key">${k}</span>`).join('')}</div>`).join('')}</div>`).join('')}</div>`;
  }

  function renderHuffman(v) {
    return `<div class="huffman-visual">${v.groups.map((g,i)=>`<div class="huffman-weight ${v.active?.includes(i)?'active':''}">${g.join('+')}</div>`).join('')}</div>`;
  }

  function renderHash(v) {
    return `<div class="hash-visual">${v.buckets.map((bucket,i)=>`<div class="hash-row"><span class="hash-index ${i===v.active?'active':''}">${i}</span><div class="hash-bucket">${bucket.map(x=>`<span class="hash-value">${x}</span>`).join(v.chaining?'<span>→</span>':'')||'<span style="color:var(--muted)">空</span>'}</div></div>`).join('')}</div>`;
  }

  function answerQuiz(btn) {
    $$('.quiz-option').forEach(b=>b.classList.remove('correct','wrong'));
    const correct=Number(btn.dataset.answer)===0;
    btn.classList.add(correct?'correct':'wrong');
    if(!correct) $('.quiz-option[data-answer="0"]').classList.add('correct');
    $('#quiz-feedback').textContent=correct?'回答正确。复杂度应结合具体操作和数据规模分析。':'答案不正确。请回看右侧复杂度卡片和动画过程。';
  }

  function toggleComplete() {
    const id=state.module.id; const idx=state.completed.indexOf(id);
    if(idx>=0)state.completed.splice(idx,1);else state.completed.push(id);
    storage.setItem('algora-completed',JSON.stringify(state.completed));
    renderShell();
  }

  window.addEventListener('hashchange',renderShell);
  window.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;
    if(e.key==='ArrowRight')step(1);
    if(e.key==='ArrowLeft')step(-1);
    if(e.key===' ') {e.preventDefault();togglePlayer();}
  });
  renderShell();
})();
