document.addEventListener('DOMContentLoaded', () => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  const modeIds = {
    linear:    { fb: 'linearFeedback', correct: 'linearCorrect', total: 'linearTotal', submit: 'linearSubmit', diff: 'linearDiff' },
    quadratic: { fb: 'quadFeedback',    correct: 'quadCorrect',    total: 'quadTotal',    submit: 'quadSubmit',    discr: 'quadDiscr' },
    simplify:  { fb: 'simpFeedback',   correct: 'simpCorrect',    total: 'simpTotal',    submit: null,           streak: 'simpStreak' }
  };

  let toastTimer;
  const showToast = (msg, type = 'info') => {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.className = 'toast', 2500);
  };

  const state = {
    score: +localStorage.getItem('math_quest_score') || 0,
    solved: +localStorage.getItem('math_quest_solved') || 0,
    streak: 0, maxStreak: +localStorage.getItem('math_quest_max_streak') || 0,
    linear:    { correct: 0, total: 0, diff: 'Легко', current: null },
    quadratic: { correct: 0, total: 0, current: null },
    simplify:  { correct: 0, total: 0, streak: 0, current: null },
    speed:     { active: false, timeLeft: 60, score: 0, streak: 0, maxRoundStreak: 0, interval: null, current: null, isProcessing: false },
    tutorial:  { step: 0, completed: +localStorage.getItem('math_quest_tutorial_done') || 0 }
  };

  const save = () => {
    localStorage.setItem('math_quest_score', state.score);
    localStorage.setItem('math_quest_solved', state.solved);
    localStorage.setItem('math_quest_max_streak', state.maxStreak);
    localStorage.setItem('math_quest_tutorial_done', state.tutorial.completed);
    updateGlobalUI();
  };

  const updateGlobalUI = () => {
    $('#globalScore').textContent = state.score;
    $('#statSolved').textContent = state.solved;
    const totalCorrect = state.linear.correct + state.quadratic.correct + state.simplify.correct;
    $('#statAccuracy').textContent = state.solved ? Math.round((totalCorrect / state.solved) * 100) + '%' : '0%';
    $('#statBestStreak').textContent = state.maxStreak;
  };

  const switchScreen = id => {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $(`#screen-${id}`).classList.add('active');
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.target === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'tutorial') renderTutorial();
  };

  $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.target)));
  $$('.mode-card').forEach(c => c.addEventListener('click', () => switchScreen(c.dataset.goto)));
  $$('input[type="text"]').forEach(inp => inp.addEventListener('focus', () => inp.scrollIntoView({ behavior: 'smooth', block: 'center' })));

  // === WELCOME MODAL ===
  const welcomeModal = $('#welcomeModal');
  welcomeModal.classList.remove('hidden');
  $('#welcomeStart').addEventListener('click', () => { welcomeModal.classList.add('hidden'); switchScreen('tutorial'); });
  $('#welcomeSkip').addEventListener('click', () => { welcomeModal.classList.add('hidden'); switchScreen('home'); });

  // === SPEED RESULT MODAL ===
  const speedResultModal = $('#speedResultModal');
  const btnStartSpeed = $('#btnStartSpeed');
  const btnFinishSpeed = $('#btnFinishSpeed');
  const showSpeedResult = () => {
    clearInterval(state.speed.interval);
    state.speed.active = false; state.speed.isProcessing = false;
    state.score += state.speed.score;
    if(state.speed.streak > 0) state.solved++;
    if(state.speed.maxRoundStreak > state.maxStreak) state.maxStreak = state.speed.maxRoundStreak;
    save();
    $('#resultScore').textContent = state.speed.score;
    $('#resultStreak').textContent = state.speed.maxRoundStreak;
    $('#resultTime').textContent = (60 - state.speed.timeLeft) + 'с';
    speedResultModal.classList.remove('hidden');
    btnFinishSpeed.classList.add('hidden');
    btnStartSpeed.classList.remove('hidden'); btnStartSpeed.textContent = '🚀 Начать'; btnStartSpeed.disabled = false;
    $('#speedOptions').innerHTML = ''; $('#speedEq').textContent = 'x + 5 = 12';
  };
  btnFinishSpeed.addEventListener('click', showSpeedResult);
  $('#btnSpeedPlayAgain').addEventListener('click', () => { speedResultModal.classList.add('hidden'); startSpeed(); });
  $('#btnSpeedClose').addEventListener('click', () => { speedResultModal.classList.add('hidden'); switchScreen('home'); });

  // === HINTS ===
  const initHints = () => {
    ['Linear','Quad','Simp','Speed'].forEach(m => {
      const btn = $(`#hint${m}`), box = $(`#hintBox${m}`);
      if(!btn || !box) return;
      btn.addEventListener('click', () => {
        const isShown = box.style.display !== 'none';
        box.style.display = isShown ? 'none' : 'block';
        btn.textContent = isShown ? '💡' : '📌';
        if(!isShown && state.tutorial.completed === 0) { state.tutorial.completed = 1; save(); }
      });
    });
  };

  // === TUTORIAL ===
  const tutData = [
    { title: "Что такое уравнение?", html: `<p>Математика изучает равенства с <b>неизвестной величиной</b> (<code>x</code>). Уравнение — это весы.</p><div class="formula-block">2x + 4 = 10</div><p>Цель: оставить <code>x</code> одного.</p><div class="example-block">📌 Мы «распакуем» <code>x</code> по шагам.</div>` },
    { title: "Линейные уравнения (пошагово)", html: `<p>Пример:</p><div class="formula-block">2x + 4 = 10</div><div class="step-list"><div class="step-item"><span>1️⃣</span><p>Переносим <code>+4</code> вправо. Знак меняется: <code>+4</code> → <code>-4</code>.</p></div><div class="step-item"><span>2️⃣</span><p>Пишем: <code>2x = 10 - 4</code>.</p></div><div class="step-item"><span>3️⃣</span><p>Считаем: <code>10 - 4 = 6</code>. Получаем <code>2x = 6</code>.</p></div><div class="step-item"><span>4️⃣</span><p>Делим обе части на 2: <code>x = 6 ÷ 2</code>.</p></div><div class="step-item"><span>✅</span><p><b>x = 3</b>. Проверка: <code>2·3 + 4 = 10</code>.</p></div></div>` },
    { title: "Квадратные уравнения", html: `<h3><code>ax² + bx + c = 0</code></h3><p>Пример:</p><div class="formula-block">x² - 5x + 6 = 0</div><div class="step-list"><div class="step-item"><span>📐</span><p><code>a=1</code>, <code>b=-5</code>, <code>c=6</code>.</p></div><div class="step-item"><span>1️⃣</span><p><code>D = (-5)² - 4·1·6 = 1</code>.</p></div><div class="step-item"><span>2️⃣</span><p><code>x = (5 ± 1) / 2</code>.</p></div><div class="step-item"><span>3️⃣</span><p><code>x₁ = 2</code>, <code>x₂ = 3</code>.</p></div></div><div class="example-block">💡 Вводи меньший корень в <code>x₁</code>, больший в <code>x₂</code>.</div>` },
    { title: "Упрощение выражений", html: `<h3>Приведение подобных</h3><div class="formula-block">3x + 2x - 5 + 7</div><div class="step-list"><div class="step-item"><span>1️⃣</span><p>Коэффициенты при <code>x</code>: <code>3+2 = 5</code> → <code>5x</code>.</p></div><div class="step-item"><span>2️⃣</span><p>Числа: <code>-5+7 = 2</code>.</p></div><div class="step-item"><span>✅</span><p>Ответ: <code>5x + 2</code>.</p></div></div>` },
    { title: "Режим «Скорость»", html: `<h3>Блиц на 60 секунд</h3><div class="formula-block">Очки = 10 + (серия × 2)</div><div class="step-list"><div class="step-item"><span>⚡</span><p>Серия растёт за верные ответы подряд.</p></div><div class="step-item"><span>🛑</span><p>Ошибка обнуляет серию. Лучше медленнее, но верно.</p></div></div>` }
  ];

  const renderTutorial = () => {
    const step = state.tutorial.step;
    $('#tutStep').textContent = step + 1; $('#tutTotal').textContent = tutData.length;
    $('#tutContent').innerHTML = `<h3>${tutData[step].title}</h3>${tutData[step].html}`;
    $('#tutPrev').style.visibility = step === 0 ? 'hidden' : 'visible';
    $('#tutNext').style.display = step === tutData.length - 1 ? 'none' : 'block';
    $('#tutFinish').style.display = step === tutData.length - 1 ? 'block' : 'none';
  };
  $('#tutNext').addEventListener('click', () => { if(state.tutorial.step < tutData.length - 1) { state.tutorial.step++; renderTutorial(); }});
  $('#tutPrev').addEventListener('click', () => { if(state.tutorial.step > 0) { state.tutorial.step--; renderTutorial(); }});
  $('#tutFinish').addEventListener('click', () => { state.tutorial.completed = 1; save(); switchScreen('linear'); showToast('🎓 Обучение пройдено!', 'success'); });

  // === GAME MODES ===
  const generateLinear = () => {
    const diff = state.linear.diff === 'Легко' ? 1 : state.linear.diff === 'Средне' ? 2 : 3;
    const a = rand(1, 5 + diff * 3), x = rand(-10, 10 + diff * 5), b = rand(-20, 20 + diff * 5), c = a * x + b;
    state.linear.current = { a, x, b, c };
    $('#linearEq').textContent = `${a === 1 ? '' : a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${c}`;
    $('#linearInput').value = ''; $(`#${modeIds.linear.fb}`).style.display = 'none'; $(`#${modeIds.linear.submit}`).disabled = false;
    setTimeout(() => $('#linearInput').focus(), 150);
  };
  const checkLinear = () => {
    const val = parseFloat($('#linearInput').value.trim().replace(',', '.'));
    if (isNaN(val)) { showToast('Введите число!', 'error'); return; }
    handleResult('linear', Math.abs(val - state.linear.current.x) < 0.01, state.linear.current.x);
  };
  $('#linearSubmit').addEventListener('click', checkLinear);
  $('#linearInput').addEventListener('keydown', e => { if(e.key==='Enter') checkLinear(); });

  const formatQuad = (a, b, c) => {
    let p = [];
    if (a !== 0) p.push(a === 1 ? 'x²' : a === -1 ? '-x²' : `${a}x²`);
    if (b !== 0) p.push(`${b > 0 && p.length ? '+ ' : b < 0 ? '- ' : ''}${Math.abs(b) === 1 ? '' : Math.abs(b)}x`);
    if (c !== 0) p.push(`${c > 0 && p.length ? '+ ' : c < 0 ? '- ' : ''}${Math.abs(c)}`);
    return (p.length ? p.join(' ') : '0') + ' = 0';
  };
  const generateQuadratic = () => {
    let r1 = rand(-6, 6), r2 = rand(-6, 6);
    if (r1 === r2) r2 = r1 + rand(1, 3);
    if (r1 === 0) r1 = rand(1, 3); if (r2 === 0) r2 = rand(-3, -1);
    const a = 1, b = -a*(r1+r2), c = a*r1*r2, D = b*b-4*a*c;
    state.quadratic.current = { a, b, c, roots: [Math.min(r1,r2), Math.max(r1,r2)], D };
    $('#quadEq').textContent = formatQuad(a, b, c);
    $('#quadX1').value = ''; $('#quadX2').value = ''; $(`#${modeIds.quadratic.fb}`).style.display = 'none';
    $(`#${modeIds.quadratic.discr}`).textContent = `D=${D}`; $(`#${modeIds.quadratic.submit}`).disabled = false;
    setTimeout(() => $('#quadX1').focus(), 150);
  };
  const checkQuadratic = () => {
    const p = v => parseFloat(v.trim().replace(',', '.'));
    const x1 = p($('#quadX1').value.split(/[\s,]+/)[0]), x2 = p($('#quadX2').value.split(/[\s,]+/)[0]);
    if(isNaN(x1)||isNaN(x2)){showToast('Введите оба корня!','error');return;}
    const u=[Math.min(x1,x2),Math.max(x1,x2)], r=state.quadratic.current.roots;
    handleResult('quadratic', Math.abs(u[0]-r[0])<0.01 && Math.abs(u[1]-r[1])<0.01, r.join(', '));
  };
  $('#quadSubmit').addEventListener('click', checkQuadratic);
  $$('#quadX1, #quadX2').forEach(inp => inp.addEventListener('keydown', e => {
    if(e.key==='Enter'){e.preventDefault(); inp.id==='quadX1' ? $('#quadX2').focus() : checkQuadratic();}
  }));

  const generateSimplify = () => {
    const k1=rand(2,9), k2=rand(2,9), n1=rand(-10,10), n2=rand(-10,10);
    const expr = `${k1}x + ${k2}x + (${n1}) - (${n2})`;
    const ansK = k1 + k2, ansN = n1 - n2;
    const ans = `${ansK}x ${ansN >= 0 ? '+' : '-'} ${Math.abs(ansN)}`;
    state.simplify.current = { expr, ans };
    $('#simpExpr').textContent = expr; $(`#${modeIds.simplify.fb}`).style.display = 'none'; $('#simpOptions').innerHTML = '';
    const opts = new Set([ans]); let attempts = 0;
    while(opts.size < 4 && attempts < 50) {
      const wrongK = ansK + rand(-2, 2) || ansK + 1;
      const wrongN = ansN + rand(-3, 3) || ansN + 2;
      const wrongSign = Math.random() > 0.5 ? '+' : '-';
      const wrongOpt = `${wrongK}x ${wrongSign} ${Math.abs(wrongN)}`;
      if(wrongOpt !== ans) opts.add(wrongOpt); attempts++;
    }
    shuffle(Array.from(opts)).forEach(opt => {
      const btn = document.createElement('button'); btn.className = 'option-btn'; btn.textContent = opt;
      btn.addEventListener('click', () => {
        const correct = opt === ans;
        handleResult('simplify', correct, ans);
        $$('.option-btn').forEach(b => { if(b.textContent === ans) b.classList.add('correct'); if(b === btn && !correct) b.classList.add('wrong'); });
      });
      $('#simpOptions').appendChild(btn);
    });
  };

  const uniqueOptions = (correct, count=4) => {
    const opts = new Set([String(correct)]); const num = typeof correct === 'number' ? correct : parseFloat(correct.split(',')[0]);
    let attempts = 0;
    while(opts.size < count && attempts < 30) { const d = rand(-3,3); if(d===0){attempts++;continue;} opts.add(typeof correct==='number'?String(num+d):`${num+d}, ${num+d+1}`); attempts++; }
    return shuffle(Array.from(opts));
  };
  const setSpeedButtonsDisabled = (disabled) => {
    $$('#speedOptions .option-btn').forEach(btn => { btn.style.pointerEvents = disabled ? 'none' : 'auto'; btn.style.opacity = disabled ? '0.5' : '1'; });
  };
  const generateSpeedQ = () => {
    state.speed.isProcessing = false; setSpeedButtonsDisabled(false);
    const t = rand(0,2);
    if(t===0) { const a=rand(1,9),x=rand(-8,8),b=rand(-15,15),c=a*x+b; state.speed.current={type:'linear',ans:x,eq:`${a}x ${b>=0?'+':'-'} ${Math.abs(b)} = ${c}`}; }
    else if(t===1) { const r1=rand(-4,4),r2=rand(-4,4),b=-(r1+r2),c=r1*r2; state.speed.current={type:'quad',ans:`${Math.min(r1,r2)}, ${Math.max(r1,r2)}`,eq:`x² ${b>=0?'+':'-'} ${Math.abs(b)}x + ${c} = 0`}; }
    else { const k1=rand(2,7),k2=rand(2,7),n=rand(-8,8); state.speed.current={type:'simp',ans:`${k1+k2}x ${n>=0?'+':'-'} ${Math.abs(n)}`,eq:`${k1}x + ${k2}x ${n>=0?'+':'-'} ${Math.abs(n)}`}; }
    $('#speedEq').textContent = state.speed.current.eq; const grid = $('#speedOptions'); grid.innerHTML = '';
    uniqueOptions(state.speed.current.ans).forEach(opt => {
      const btn = document.createElement('button'); btn.className='option-btn'; btn.textContent=opt;
      btn.addEventListener('click', () => { if(!state.speed.active || state.speed.isProcessing) return; handleSpeedResult(String(opt).trim()===String(state.speed.current.ans).trim(), opt); });
      grid.appendChild(btn);
    });
  };
  const handleSpeedResult = (correct, picked) => {
    if(!state.speed.active || state.speed.isProcessing) return;
    state.speed.isProcessing = true; setSpeedButtonsDisabled(true);
    if(correct) { state.speed.streak++; if(state.speed.streak > state.speed.maxRoundStreak) state.speed.maxRoundStreak = state.speed.streak; state.speed.score += 10 + state.speed.streak * 2; showToast(`✅ +${10+state.speed.streak*2}`, 'success'); }
    else { state.speed.streak = 0; showToast('❌ Ошибка', 'error'); }
    $('#speedScore').textContent = state.speed.score; $('#speedStreak').textContent = state.speed.streak;
    $$('.option-btn').forEach(b => { if(String(b.textContent).trim()===String(state.speed.current.ans).trim()) b.classList.add('correct'); if(String(b.textContent).trim()===String(picked).trim() && !correct) b.classList.add('wrong'); });
    setTimeout(generateSpeedQ, 600);
  };
  const startSpeed = () => {
    if(state.speed.active) return;
    state.speed.active = true; state.speed.score = 0; state.speed.streak = 0; state.speed.maxRoundStreak = 0; state.speed.isProcessing = false; state.speed.startTime = Date.now();
    btnStartSpeed.classList.add('hidden'); btnFinishSpeed.classList.remove('hidden');
    $('#speedScore').textContent = 0; $('#speedStreak').textContent = 0; $('#speedFeedback').style.display = 'none';
    generateSpeedQ();
    state.speed.interval = setInterval(() => { const e = Math.floor((Date.now()-state.speed.startTime)/1000); state.speed.timeLeft = Math.max(0, 60-e); $('#speedTime').textContent = state.speed.timeLeft; $('#speedTimeStat').textContent = 60-state.speed.timeLeft; $('#timerFill').style.width = `${(state.speed.timeLeft/60)*100}%`; if(state.speed.timeLeft <= 0) showSpeedResult(); }, 200);
  };
  btnStartSpeed.addEventListener('click', startSpeed);

  const handleResult = (mode, correct, ans) => {
    const ids = modeIds[mode]; state[mode].total++; state.solved++;
    const fb = $(`#${ids.fb}`); fb.style.display = 'block';
    if(correct) { state[mode].correct++; state.streak++; if(state.streak > state.maxStreak) state.maxStreak = state.streak; state.score += mode === 'quadratic' ? 30 : 15; fb.className = 'feedback success'; fb.textContent = `✅ Верно! Ответ: ${ans}`; showToast(mode === 'linear' ? '👍 Отлично!' : '🔥 Серия растёт!', 'success'); }
    else { state.streak = 0; fb.className = 'feedback error'; fb.textContent = `❌ Ошибка. Верно: ${ans}`; showToast('💡 Попробуй ещё!', 'error'); }
    save(); $(`#${ids.correct}`).textContent = state[mode].correct; $(`#${ids.total}`).textContent = state[mode].total;
    if(mode === 'simplify') $(`#${ids.streak}`).textContent = state.simplify.streak; if(mode === 'linear') $(`#${ids.diff}`).textContent = state.linear.diff;
    const submitBtn = ids.submit ? $(`#${ids.submit}`) : null; if(submitBtn) submitBtn.disabled = false;
    setTimeout(() => { if(mode === 'linear') generateLinear(); else if(mode === 'quadratic') generateQuadratic(); else generateSimplify(); }, 1200);
  };

  // === SCRATCHPAD ===
  const initScratchpad = () => {
    const canvas = $('#scratchCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false, isErasing = false, lastX = 0, lastY = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const header = canvas.parentElement.querySelector('.scratchpad-header');
      const parentRect = canvas.parentElement.getBoundingClientRect();
      const w = parentRect.width;
      const h = parentRect.height - (header?.offsetHeight || 50);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    };

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top };
    };

    const start = (e) => {
      e.preventDefault();
      isDrawing = true;
      isErasing = e.button === 2;
      canvas.classList.toggle('eraser-active', isErasing);
      const p = getPos(e); lastX = p.x; lastY = p.y;
      ctx.beginPath(); ctx.moveTo(lastX, lastY);
    };
    const move = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineWidth = isErasing ? 18 : 3;
      ctx.strokeStyle = isErasing ? '#fafbfc' : '#2C3E50';
      ctx.lineTo(p.x, p.y); ctx.stroke();
      lastX = p.x; lastY = p.y;
    };
    const end = () => { isDrawing = false; isErasing = false; canvas.classList.remove('eraser-active'); ctx.beginPath(); };

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);

    const toggleBtn = $('#scratchpadToggle');
    toggleBtn.addEventListener('click', () => {
      const panel = $('#scratchpadPanel');
      const isOpen = panel.classList.toggle('closed');
      toggleBtn.classList.toggle('open', !isOpen);
      toggleBtn.textContent = isOpen ? '📝 Черновик' : '✖ Закрыть';
      $('main').classList.toggle('shifted', !isOpen);
      if (!isOpen) {
        resize();
        const hint = $('#scratchpadHint');
        hint.classList.add('show');
        setTimeout(() => hint.classList.remove('show'), 3000);
      }
    });

    $('#scratchpadClose').addEventListener('click', () => {
      $('#scratchpadPanel').classList.add('closed'); toggleBtn.classList.remove('open'); toggleBtn.textContent = '📝 Черновик'; $('main').classList.remove('shifted');
    });
    $('#scratchpadClear').addEventListener('click', () => {
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore();
    });
    window.addEventListener('resize', () => { if (!$('#scratchpadPanel').classList.contains('closed')) resize(); });
    resize();
  };

  updateGlobalUI(); generateLinear(); generateQuadratic(); generateSimplify(); initHints(); initScratchpad();
});
