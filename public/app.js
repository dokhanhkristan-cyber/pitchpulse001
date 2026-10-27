(() => {
  'use strict';
  const $ = sel => document.querySelector(sel);
  const app = $('#app');
  const stage = $('#stage');
  const socket = io({ reconnection: true, reconnectionDelayMax: 5000 });
  const HKEY = 'pitchpulse.host';
  const TKEY = 'pitchpulse.team';
  const state = {
    view: 'home', room: null, role: null, auth: null, amount: 5,
    enteredCode: new URLSearchParams(location.search).get('join') || '',
    stageDismissed: false, stageShown: '', soundAvailable: false, restoring: false
  };
  let stageTimer = null;
  let counterRAF = null;
  let confettiRAF = null;
  let audioCtx = null;
  let lastPhase = '';

  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const f = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const money = n => `$${f(n)}M`;
  const exactMoney = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h5l4-12 6 17 4-10h5"/></svg>`;
  const brand = `<span class="brand"><span class="logo-mark">${icon}</span><span>PITCH<span class="brand-em">PULSE</span><span style="font-size:9px;letter-spacing:.05em;vertical-align:top;margin-left:4px;color:#73758b">LIVE</span></span></span>`;

  function toast(message, bad = false) {
    const el = document.createElement('div');
    el.className = `toast${bad ? ' error' : ''}`;
    el.textContent = message;
    $('#toast-root').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
  function request(event, payload = {}) {
    return new Promise(resolve => socket.timeout(7000).emit(event, payload, (error, reply) => {
      resolve(error ? { ok: false, error: 'Không kết nối được với máy chủ.' } : reply || { ok: false, error: 'Không có phản hồi.' });
    }));
  }
  function nav() {
    const label = !socket.connected ? 'Mất kết nối' : state.role === 'host' ? `HOST · ${state.room?.code || ''}` : state.role === 'team' ? `TEAM · ${state.room?.code || ''}` : 'Live investment game';
    return `<div class="container"><header class="navbar">
      <a href="#" data-action="home" aria-label="Pitch Pulse">${brand}</a>
      <div class="nav-right"><span class="header-micro">THE INVESTMENT EXPERIENCE</span><span class="online-pill ${socket.connected ? '' : 'offline'}"><span class="live-dot"></span>${escapeHtml(label)}</span></div>
    </header></div>`;
  }
  function landing() {
    return `${nav()}<main><div class="container hero">
      <section class="hero-copy">
        <div class="hero-kicker"><span class="kicker-line"></span> EVERY DECISION COUNTS</div>
        <h1 class="hero-title">THE<br><span class="outline">BIG</span><br><span class="lime">PITCH.</span></h1>
        <p class="hero-description">Một ý tưởng. Nhiều nhà đầu tư. <b>Ai sẽ đặt cược?</b> Mỗi nhóm có <b>$10 triệu</b> để đầu tư, và toàn bộ kết quả sẽ được công bố trong một khoảnh khắc không thể quên.</p>
        <div class="hero-actions"><button class="btn btn-primary btn-large" data-action="go-host">TẠO PHÒNG · HOST <span class="arrow">↗</span></button><button class="btn btn-ghost btn-large" data-action="go-team">THAM GIA NHÓM <span class="arrow">→</span></button></div>
        <div class="hero-foot"><span>● REAL-TIME</span><span class="divider-vert"></span><span>● PRIVATE VOTING</span><span class="divider-vert"></span><span>● LIVE REVEAL</span></div>
      </section>
      <div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-glow"></div><div class="art-card">
        <div class="art-card-top"><span class="art-small">FUNDING ROUND / 001</span><span class="art-live"><span class="live-dot"></span> LIVE</span></div>
        <div class="art-label">TOTAL INVESTMENT</div><div class="art-dollar">$??<span>.??</span>M</div>
        <div style="font-size:12px;color:#a0a0b3;margin-top:17px">The biggest reveal is yet to come.</div>
        <div class="art-progress"></div><div class="art-row"><span>FUNDING IN PROGRESS</span><span>SEALED 🔒</span></div>
        <div class="art-sticker">IT'S SHOWTIME ✦</div>
      </div><div class="art-note">↗ EVERY MILLION MATTERS</div></div>
    </div><div class="container landing-bottom"><span>© PITCH PULSE — <strong>WHERE IDEAS MEET CAPITAL.</strong></span><span>BUILT FOR THE BIG REVEAL ✦</span></div></main>`;
  }
  function hostForm() {
    return `${nav()}<main class="container auth-layout"><section class="auth-copy"><span class="eyebrow">01 / SET THE STAGE</span>
      <h1>YOUR STAGE.<br><em>YOUR RULES.</em></h1>
      <p>Đặt tên dự án, mở vòng gọi vốn và chia sẻ mã phòng. Mọi quyết định đầu tư sẽ được giữ bí mật cho đến khi bạn bấm Reveal.</p>
      <div class="step-mini"><div class="step-num">01</div><div><strong>Tạo phòng</strong><span>Host nhận mã 6 ký tự để chia sẻ cho các nhóm.</span></div></div>
      <div class="step-mini"><div class="step-num">02</div><div><strong>Các nhóm đầu tư bí mật</strong><span>Mỗi nhóm có quyền phân bổ tối đa $10M.</span></div></div>
      <div class="step-mini"><div class="step-num">03</div><div><strong>Make it a moment</strong><span>Nhạc trống, đếm ngược, spotlight, reveal tổng vốn.</span></div></div>
      </section><section class="auth-card"><div class="card-overline">✦ HOST CONTROL CENTER</div><h2>Create your room.</h2><div class="subtitle">Một màn gọi vốn đỉnh cao bắt đầu từ đây.</div>
      <form id="host-create-form"><div class="field"><label for="project-name">TÊN DỰ ÁN / PITCH</label><input class="input" id="project-name" name="project" maxlength="70" value="THE NEXT BIG IDEA" required autocomplete="off"/><div class="field-hint">Có thể thay đổi khi chuyển sang dự án mới.</div></div>
      <button type="submit" class="btn btn-primary btn-block btn-large">KHỞI TẠO PHÒNG <span class="arrow">↗</span></button></form>
      <div class="auth-side-note"><span>🔐</span><span>Quyền Host được lưu trên trình duyệt này để bạn có thể trở lại phòng sau khi tải lại trang.</span></div>
      <div class="auth-switch">Là thành viên một nhóm? <button data-action="go-team">Tham gia tại đây →</button></div>
      </section></main>`;
  }
  function teamForm() {
    return `${nav()}<main class="container auth-layout"><section class="auth-copy"><span class="eyebrow">02 / JOIN THE ROUND</span>
      <h1>READY TO<br><em>INVEST?</em></h1>
      <p>Mỗi nhóm nắm giữ <b style="color:white">$10 million USD</b>. Quyết định rót vốn hay đứng ngoài. Chỉ nhóm bạn mới thấy con số mình đã chọn trước màn reveal.</p>
      <div class="step-mini"><div class="step-num">01</div><div><strong>Nhập mã phòng</strong><span>Lấy từ Host hoặc đường link được chia sẻ.</span></div></div>
      <div class="step-mini"><div class="step-num">02</div><div><strong>Tạo tài khoản nhóm</strong><span>Đặt tên nhóm và PIN 4 số để truy cập lại.</span></div></div>
      <div class="step-mini"><div class="step-num">03</div><div><strong>Chốt quyết định</strong><span>Nhập mức đầu tư từ $0M đến $10M.</span></div></div>
      </section><section class="auth-card"><div class="card-overline">✦ INVESTOR ENTRY</div><h2>Enter the room.</h2><div class="subtitle">Mỗi nhóm cần một cái tên và mã PIN riêng.</div>
      <form id="team-join-form"><div class="field"><label for="room-code">MÃ PHÒNG</label><input class="input input-code" id="room-code" name="code" maxlength="6" placeholder="ABC123" value="${escapeHtml(state.enteredCode)}" required autocomplete="off"/></div>
      <div class="field"><label for="team-name">TÊN NHÓM</label><input class="input" id="team-name" name="team" maxlength="40" minlength="2" placeholder="VD: NOVA CAPITAL" required autocomplete="off"/></div>
      <div class="field"><label for="team-pin">PIN CỦA NHÓM · 4 SỐ</label><input class="input input-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" id="team-pin" name="pin" placeholder="••••" required autocomplete="off"/><div class="field-hint">Nhóm mới sẽ được tạo tự động. Nếu đã có nhóm, nhập lại đúng PIN để đăng nhập.</div></div>
      <button class="btn btn-primary btn-block btn-large" type="submit">THAM GIA VÒNG ĐẦU TƯ <span class="arrow">→</span></button></form>
      <div class="auth-switch">Là người tổ chức? <button data-action="go-host">Tạo phòng Host →</button></div>
      </section></main>`;
  }
  function hostView() {
    const r = state.room; if (!r) return landing();
    const count = r.groupCount || 0;
    const submitted = r.investedCount || 0;
    const percent = count ? Math.round(submitted / count * 100) : 0;
    const complete = count > 0 && count === submitted;
    const revealed = r.phase === 'revealed';
    const demoCount = r.teams.filter(t => t.demo).length;
    const rows = r.teams.map((t, i) => {
      const finalEntry = revealed ? r.result?.teams.find(row => row.id === t.id) : null;
      return `<div class="team-row"><div class="team-ident"><div class="team-avatar">${String(i + 1).padStart(2, '0')}</div><div style="min-width:0"><div class="team-name">${escapeHtml(t.name)}</div><div class="team-meta">${t.demo ? 'DEMO ACCOUNT' : 'INVESTOR TEAM'} · #${String(i + 1).padStart(2, '0')}</div></div></div><span class="team-state ${t.submitted ? 'done' : 'waiting'}"><span class="mini-dot"></span>${revealed && finalEntry ? (finalEntry.amount === null ? 'CHƯA ĐẦU TƯ' : money(finalEntry.amount)) : t.submitted ? 'ĐÃ CHỐT ✓' : 'ĐANG CHỜ'}</span></div>`;
    }).join('');
    return `${nav()}<main class="container dashboard"><div class="section-top"><div><div class="eyebrow">HOST DASHBOARD / LIVE SESSION</div><h1>Mission <span style="color:var(--lime)">control.</span></h1><p>${escapeHtml(r.title)} <span style="color:#5e6073;margin:0 12px">/</span> ${revealed ? 'Vòng gọi vốn đã kết thúc' : 'Hãy để các nhóm đặt cược vào ý tưởng.'}</p></div>
      <div class="host-toolbar"><button class="btn btn-ghost btn-small" data-action="fullscreen">⛶ &nbsp;TRÌNH CHIẾU</button>${revealed ? `<button class="btn btn-ghost btn-small" data-action="export">↓ &nbsp;XUẤT CSV</button>` : ''}</div></div>
      <div class="room-strip"><div><div class="room-caption">YOUR ROOM CODE</div><div class="room-code">${escapeHtml(r.code)}</div></div><div class="share-help">Chia sẻ mã phòng hoặc đường link để các nhóm tham gia.</div><button class="btn btn-ghost btn-small" data-action="copy-code">⧉ MÃ PHÒNG</button><button class="btn btn-primary btn-small" data-action="copy-link">↗ COPY LINK</button></div>
      <div class="stats-grid"><div class="stat-card"><div class="stat-name">SỐ NHÓM THAM GIA</div><div class="stat-number">${count.toString().padStart(2,'0')}</div></div><div class="stat-card"><div class="stat-name">ĐÃ CHỐT ĐẦU TƯ</div><div class="stat-number">${submitted.toString().padStart(2,'0')}<small> / ${count}</small></div></div><div class="stat-card"><div class="stat-name">QUỸ TỐI ĐA</div><div class="stat-number" style="color:var(--violet)">$${f(count * 10)}<small>M</small></div></div></div>
      <div class="host-layout"><section class="dash-card"><header class="dash-card-heading"><div><h2>Investor lineup.</h2><p>Danh sách nhóm tham gia • Số tiền được giữ bí mật đến reveal</p></div><span class="status-pill"><span class="live-dot"></span>${r.phase === 'open' ? 'ĐANG MỞ' : revealed ? 'ĐÃ REVEAL' : 'REVEALING'}</span></header>
      ${rows ? `<div class="team-list">${rows}</div>` : `<div class="empty-teams"><div class="empty-icon">◌</div><strong>Chưa có nhóm tham gia</strong><p>Chia sẻ mã <b style="color:var(--lime)">${escapeHtml(r.code)}</b> hoặc nhấn "Thêm demo" để trải nghiệm nhanh.</p></div>`}</section>
      <section class="dash-card"><header class="dash-card-heading"><div><h2>The big moment.</h2><p>Điều khiển màn công bố tổng đầu tư</p></div></header><div class="control-inner">
      <div class="control-badge"><span class="live-dot"></span>${revealed ? 'FUNDING REVEALED' : complete ? 'ALL TEAMS LOCKED IN' : 'ACCEPTING INVESTMENTS'}</div>
      ${revealed ? `<p style="font-size:12px;margin:2px 0 12px">TỔNG VỐN ĐẦU TƯ</p><div style="font:700 56px var(--display);letter-spacing:-.08em;color:var(--lime)">${money(r.result?.total)}</div><p>Đã ghi nhận ${submitted}/${count} quyết định từ các nhóm.</p><button class="btn btn-primary btn-block btn-large" data-action="show-result">✦ XEM LẠI REVEAL</button><button class="btn btn-ghost btn-block" data-action="new-project">↺ BẮT ĐẦU DỰ ÁN MỚI</button>` : `<p>Các nhóm có thể gửi hoặc cập nhật mức đầu tư. Bạn chọn thời điểm khóa vòng gọi vốn và bắt đầu phần trình diễn.</p><div class="progress-row"><span>TIẾN ĐỘ ĐẦU TƯ</span><span>${submitted} / ${count} TEAMS</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <button class="btn btn-primary btn-block btn-large" data-action="reveal" ${submitted === 0 || r.phase !== 'open' ? 'disabled' : ''}>✦ &nbsp;START THE REVEAL <span class="arrow">↗</span></button><div class="tip-box"><b>🎬 SHOWTIME TIP</b><br>Chiếu màn Host lên máy chiếu, bật loa, và bấm Reveal. Trống tăng tốc trong 7,5 giây trước khi spotlight bật sáng và hiện tổng tiền.</div>`}
      </div></section></div>
      ${r.phase === 'open' ? `<div class="demo-controls"><button class="text-btn" data-action="demo">✦ THÊM 5 NHÓM DEMO ĐỂ THỬ HIỆU ỨNG</button>${demoCount ? `<button class="text-btn" data-action="clear-demo">XÓA ${demoCount} NHÓM DEMO</button>` : ''}<span class="muted" style="font-size:10px">* Nhóm demo được tính vào tổng, hãy xóa trước khi tổ chức thật.</span></div>` : ''}
      </main>`;
  }
  function teamView() {
    const r = state.room; if (!r) return landing();
    const me = r.me || { name: '', amount: null };
    const locked = r.phase !== 'open';
    const selected = Math.max(0, Math.min(10, Number(state.amount) || 0));
    const remaining = 10 - selected;
    const hasSubmitted = me.amount !== null;
    const revealed = r.phase === 'revealed';
    return `${nav()}<main class="container team-layout"><div class="team-headline"><div><div class="eyebrow">WELCOME TO THE INVESTOR'S TABLE</div><h1>Hey, <span style="color:var(--lime)">${escapeHtml(me.name)}.</span></h1><p>Dự án: <b style="color:#e3e2ec">${escapeHtml(r.title)}</b>. ${locked ? 'Vòng đầu tư đã đóng.' : 'Đây là lúc bạn đưa ra quyết định.'}</p></div><div class="tiny-pill"><span class="live-dot"></span>${revealed ? 'KẾT QUẢ ĐÃ CÓ' : locked ? 'ĐANG CÔNG BỐ' : 'VÒNG ĐANG MỞ'}</div></div>
      <div class="team-workspace"><section class="balance-card"><div class="balance-top"><div class="balance-name">YOUR PRIVATE FUND</div><div class="balance-icon">✦</div></div><div class="balance-value">$10<span>M</span></div><div class="balance-caption">TỔNG NGÂN SÁCH CỦA NHÓM</div><div class="balance-divider"></div><div class="balance-bottom"><div><small>YOUR INVESTMENT</small><strong style="color:var(--lime)">${money(hasSubmitted && locked ? me.amount : selected)}</strong></div><div style="text-align:right"><small>REMAINING FUND</small><strong>${money(hasSubmitted && locked ? 10 - me.amount : remaining)}</strong></div></div></section>
      <section class="investment-card"><div class="eyebrow">MAKE YOUR MOVE / 001</div><h2>${revealed ? 'The verdict is in.' : locked ? 'Investments are locked.' : 'How much do you believe?'}</h2><p>${revealed ? 'Các nhà đầu tư đã lên tiếng. Xem tổng vốn và lựa chọn của từng nhóm.' : locked ? 'Hãy cùng theo dõi sân khấu chính!' : 'Chọn số tiền từ $0M đến $10M. Nhập $0M nếu nhóm quyết định không đầu tư.'}</p>
      ${revealed ? `<div class="invest-success"><div class="success-title">✓ VÒNG ĐẦU TƯ KẾT THÚC</div><div class="success-number">${me.amount === null ? 'NO BID' : money(me.amount)}</div><p>Khoản đầu tư của nhóm bạn.</p></div><button class="btn btn-primary btn-block btn-large" data-action="show-result">✦ XEM KẾT QUẢ CHUNG</button>` : locked ? `<div class="invest-success"><div class="success-title">● YOUR BID IS LOCKED</div><div class="success-number">${me.amount === null ? 'NO BID' : money(me.amount)}</div><p>Đang tổng hợp các quyết định đầu tư...</p></div>` : `<div class="amount-box"><span class="currency">$</span><input class="amount-input" type="number" id="amount-input" min="0" max="10" step="0.01" inputmode="decimal" value="${selected}" aria-label="Số tiền đầu tư tính bằng triệu USD"><span class="amount-suffix">MILLION USD</span></div>
      <input class="range" type="range" id="amount-slider" min="0" max="10" step="0.25" value="${selected}" aria-label="Chọn số tiền đầu tư"><div class="range-ends"><span>$0M · PASS</span><span>$10M · ALL IN</span></div>
      <div class="quick-row">${[0,2.5,5,7.5,10].map(n => `<button class="quick ${selected === n ? 'active' : ''}" data-action="amount" data-amount="${n}">${n === 0 ? 'PASS' : n === 10 ? 'ALL IN' : `$${n}M`}</button>`).join('')}</div>
      <button class="btn btn-primary btn-block btn-large" data-action="invest">${hasSubmitted ? '↻ CẬP NHẬT KHOẢN ĐẦU TƯ' : '↗ CONFIRM INVESTMENT'}</button>
      ${hasSubmitted ? `<div class="invest-note" style="color:var(--lime)">✓ Đã ghi nhận ${money(me.amount)}. Bạn có thể điều chỉnh khi vòng còn mở.</div>` : `<div class="invest-note">🔒 Khoản đầu tư được bảo mật đến khi Host công bố kết quả.</div>`}`}
      </section></div><div class="team-ticker"><span>● ROOM <b>${escapeHtml(r.code)}</b> · ${escapeHtml(r.title)}</span><span><b>${r.investedCount}/${r.groupCount}</b> GROUPS LOCKED IN</span></div></main>`;
  }
  function render() {
    const route = state.view;
    app.innerHTML = route === 'host-form' ? hostForm() : route === 'team-form' ? teamForm() : route === 'host' ? hostView() : route === 'team' ? teamView() : landing();
    syncStage();
  }
  function applySnapshot(snapshot, role) {
    if (!snapshot) return;
    const previous = state.room?.phase || '';
    state.room = snapshot;
    state.role = role;
    state.view = role;
    if (previous === 'revealed' && snapshot.phase === 'open') { state.stageDismissed = false; state.stageShown = ''; }
    if (snapshot.phase === 'countdown' && previous !== 'countdown') state.stageDismissed = false;
    if (snapshot.phase === 'revealed' && previous !== 'revealed') state.stageDismissed = false;
    render();
  }
  function syncStage() {
    const room = state.room;
    if (!room || room.phase === 'open' || state.stageDismissed) {
      stage.classList.add('hidden'); stopStageTimer(); return;
    }
    stage.classList.remove('hidden');
    if (room.phase === 'countdown') {
      if (state.stageShown !== `countdown:${room.code}`) {
        state.stageShown = `countdown:${room.code}`;
        stage.className = 'stage countdown';
        stage.innerHTML = `${stageDecor()}<div class="stage-content"><div class="stage-eyebrow">✦ THE INVESTMENT DECISION ✦</div><h1 class="stage-title">THE ROOM HAS<br>SPOKEN.</h1><div class="stage-subtitle">Đang tổng hợp ${room.investedCount} khoản đầu tư. Bạn đã sẵn sàng?</div><div id="stage-digit" class="stage-digit">8</div><div class="stage-count-note">SECONDS TO THE BIG REVEAL</div><div class="stage-loader"></div></div><div class="sound-indicator">♫ CINEMATIC DRUMROLL</div>`;
        if (audioCtx && audioCtx.state === 'running') playDrumroll(Math.max(0.1, (room.revealAt - Date.now()) / 1000));
        stopStageTimer();
        stageTimer = setInterval(updateStageDigit, 90);
      }
      updateStageDigit();
    } else if (room.phase === 'revealed') {
      stopStageTimer();
      if (state.stageShown !== `revealed:${room.code}`) {
        state.stageShown = `revealed:${room.code}`;
        drawReveal();
      }
    }
  }
  function stageDecor() {
    return `<div class="spotlight left"></div><div class="spotlight right"></div><div class="stage-ring"></div><div class="stage-toppane"><div class="stage-brand">PITCH<span style="color:var(--lime)">PULSE</span> / LIVE</div><div class="stage-tag">✦ ${escapeHtml(state.room?.title)} ✦</div></div><div class="stage-footer">THE BIGGEST MOMENT OF THE NIGHT.</div>`;
  }
  function updateStageDigit() {
    if (!state.room || state.room.phase !== 'countdown') return;
    const rem = Math.max(0, state.room.revealAt - Date.now());
    const el = $('#stage-digit');
    if (!el) return;
    const number = Math.max(1, Math.ceil(rem / 1000));
    const value = rem < 1050 ? '✦' : number.toString();
    if (el.textContent !== value) {
      el.textContent = value;
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'digit-pop .48s ease both';
    }
  }
  function stopStageTimer() { if (stageTimer) clearInterval(stageTimer); stageTimer = null; }
  function drawReveal() {
    const r = state.room; const result = r.result || { total: 0, teams: [] };
    const rows = result.teams.map((t, i) => `<div class="breakdown-row"><div class="breakdown-name">${String(i + 1).padStart(2,'0')} &nbsp; ${escapeHtml(t.name)}</div><div class="breakdown-track"><div class="breakdown-bar" style="width:${t.amount === null ? 0 : t.amount * 10}%;animation-delay:${Math.min(i * 95, 500)}ms"></div></div><div class="breakdown-amount">${t.amount === null ? 'NO BID' : money(t.amount)}</div></div>`).join('');
    stage.className = 'stage revealed';
    stage.innerHTML = `${stageDecor()}<div class="stage-content">
      <div class="stage-eyebrow">✦ THE RESULTS ARE IN ✦</div><h1 class="stage-result-title">THE BIG <span>REVEAL.</span></h1>
      <div class="stage-money"><span id="money-counter">$0.00</span><small>M</small></div>
      <div class="stage-result-sub">TỔNG VỐN ĐẦU TƯ TỪ <b>${result.investedCount || 0} NHÓM</b> / ${result.groupCount || 0} NHÓM THAM GIA</div>
      <div class="stage-breakdown"><div class="breakdown-title"><span>INVESTOR LEADERBOARD</span><span>COMMITMENT</span></div>${rows || `<p class="muted" style="text-align:center">Chưa có dữ liệu.</p>`}</div>
      <div class="stage-actions"><button class="btn btn-primary" data-action="close-stage">← QUAY LẠI ${state.role === 'host' ? 'HOST DASHBOARD' : 'TRANG NHÓM'}</button>${state.role === 'host' ? `<button class="btn btn-ghost" data-action="export">↓ DOWNLOAD RESULTS</button>` : ''}</div>
      </div>`;
    revealFanfare();
    animateTotal(result.total);
    blastConfetti();
  }
  function animateTotal(total) {
    if (counterRAF) cancelAnimationFrame(counterRAF);
    const duration = 1900;
    const start = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const el = $('#money-counter');
      if (el) el.textContent = exactMoney(Math.round(total * eased * 100) / 100);
      if (progress < 1 && el) counterRAF = requestAnimationFrame(frame);
    }
    counterRAF = requestAnimationFrame(frame);
  }
  function ensureAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx ||= new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch (e) { /* audio is optional */ }
  }
  function kick(at, gainValue = .6) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator(); const vol = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(140, at); osc.frequency.exponentialRampToValueAtTime(43, at + .15);
    vol.gain.setValueAtTime(gainValue, at); vol.gain.exponentialRampToValueAtTime(.001, at + .23);
    osc.connect(vol).connect(audioCtx.destination); osc.start(at); osc.stop(at + .25);
  }
  function snare(at, gainValue = .1) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const length = Math.floor(audioCtx.sampleRate * .1);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = audioCtx.createBufferSource(); src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 520;
    const vol = audioCtx.createGain(); vol.gain.value = gainValue;
    src.connect(filter).connect(vol).connect(audioCtx.destination); src.start(at);
  }
  function playDrumroll(remaining) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    let t = audioCtx.currentTime + .03;
    const stop = t + remaining - .18;
    let beat = 0;
    while (t < stop) {
      kick(t, .28 + (beat / 32) * .35);
      if (beat % 2 === 1) snare(t, .07 + (beat / 32) * .09);
      const progress = Math.max(0, Math.min(1, 1 - (stop - t) / Math.max(remaining, 1)));
      t += .56 - .42 * Math.pow(progress, .65);
      beat++;
    }
  }
  function revealFanfare() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const at = audioCtx.currentTime + .05;
    kick(at, 1);
    [261.63, 329.63, 392.0, 523.25].forEach((hz, i) => {
      const osc = audioCtx.createOscillator(); const vol = audioCtx.createGain();
      osc.type = i < 2 ? 'triangle' : 'sine'; osc.frequency.value = hz;
      vol.gain.setValueAtTime(.0001, at + i * .03);
      vol.gain.exponentialRampToValueAtTime(.06, at + .1 + i * .03);
      vol.gain.exponentialRampToValueAtTime(.0001, at + 1.65);
      osc.connect(vol).connect(audioCtx.destination); osc.start(at + i * .03); osc.stop(at + 1.7);
    });
  }
  function blastConfetti() {
    const canvas = $('#confetti'); const ctx = canvas.getContext('2d');
    if (confettiRAF) cancelAnimationFrame(confettiRAF);
    const w = canvas.width = window.innerWidth; const h = canvas.height = window.innerHeight;
    const colors = ['#c4fb67','#ad8aff','#ffffff','#ff808a','#77e7ea'];
    const pieces = Array.from({ length: 220 }, () => ({ x: Math.random() * w, y: -Math.random() * h * .6 - 10, vx: (Math.random() - .5) * 7, vy: 2 + Math.random() * 5, rot: Math.random() * 360, spin: (Math.random() - .5) * 15, len: 4 + Math.random() * 9, color: colors[Math.floor(Math.random() * colors.length)] }));
    let frames = 0;
    function tick() {
      ctx.clearRect(0,0,w,h);
      pieces.forEach(p => { p.x += p.vx; p.y += p.vy; p.rot += p.spin; p.vx *= .995; p.vy += .06;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.fillStyle = p.color; ctx.fillRect(-p.len/2,-p.len/4,p.len,p.len/2); ctx.restore(); });
      frames++;
      if (frames < 260) confettiRAF = requestAnimationFrame(tick); else ctx.clearRect(0,0,w,h);
    }
    tick();
  }
  function setAmount(n, redraw = true, preserveInput = false) {
    const next = Math.round(Math.max(0,Math.min(10,Number(n) || 0)) * 100) / 100;
    state.amount = next;
    if (redraw) render();
    else {
      const input = $('#amount-input'), slider = $('#amount-slider');
      if (input && !preserveInput) input.value = next;
      if (slider) slider.value = next;
      const invest = $('.balance-bottom strong');
      if (invest) invest.textContent = money(next);
      const remainder = $('.balance-bottom div:last-child strong');
      if (remainder) remainder.textContent = money(10 - next);
      document.querySelectorAll('.quick').forEach(el => el.classList.toggle('active', Number(el.dataset.amount) === next));
    }
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast('Đã sao chép!')).catch(() => manualCopy(text));
    else manualCopy(text);
  }
  function manualCopy(text) {
    const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed';input.style.opacity = '0';document.body.appendChild(input);
    input.select(); const ok = document.execCommand('copy');input.remove();
    toast(ok ? 'Đã sao chép!' : `Copy thủ công: ${text}`, !ok);
  }
  function exportCSV() {
    if (!state.room?.result) return toast('Chưa có kết quả để xuất.', true);
    const rows = [['Team','Investment (million USD)','Status'],...state.room.result.teams.map(t => [t.name, t.amount === null ? '' : t.amount, t.amount === null ? 'No submission' : t.amount === 0 ? 'Pass' : 'Invested']),['TOTAL',state.room.result.total,'']];
    const csv = '\ufeff' + rows.map(row => row.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download=`pitchpulse-${state.room.code}-results.csv`;a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function forgetAuth() { localStorage.removeItem(HKEY);sessionStorage.removeItem(TKEY);state.room=null;state.role=null;state.stageDismissed=false;state.stageShown=''; }
  async function createHost(form) {
    const title = new FormData(form).get('project');
    const response = await request('host:create', { title });
    if (!response.ok) return toast(response.error, true);
    state.auth = { role:'host', code:response.code, hostKey:response.hostKey };
    localStorage.setItem(HKEY, JSON.stringify(state.auth));sessionStorage.removeItem(TKEY);
    applySnapshot(response.snapshot,'host');toast(`Đã tạo phòng ${response.code}!`);
  }
  async function joinTeam(form) {
    const data = new FormData(form);
    const auth = { role:'team', code:String(data.get('code')).trim().toUpperCase(),name:String(data.get('team')).trim(),pin:String(data.get('pin')) };
    const response = await request('team:join', auth);
    if (!response.ok) return toast(response.error, true);
    state.auth = auth;sessionStorage.setItem(TKEY, JSON.stringify(auth));localStorage.removeItem(HKEY);
    state.amount = response.snapshot.me.amount ?? 5;
    applySnapshot(response.snapshot,'team');toast(`Chào mừng nhóm ${auth.name}!`);
  }
  async function restore() {
    if (state.restoring) return;
    const rawHost = localStorage.getItem(HKEY);
    const rawTeam = sessionStorage.getItem(TKEY);
    let auth;
    try {auth = JSON.parse(rawHost || rawTeam || 'null');} catch(e) {auth=null;}
    if (!auth || (!rawHost && !rawTeam)) {render(); return;}
    state.restoring = true;
    const host = auth.role === 'host';
    const response = await request(host ? 'host:resume' : 'team:join', auth);
    state.restoring = false;
    if (!response.ok) {
      forgetAuth();state.view = state.enteredCode ? 'team-form' : 'home';render();toast(`Phiên đăng nhập trước không còn hợp lệ: ${response.error}`, true);return;
    }
    state.auth = auth;
    if (!host) state.amount = response.snapshot.me.amount ?? 5;
    applySnapshot(response.snapshot, host ? 'host' : 'team');
  }

  document.addEventListener('submit', async ev => {
    if (ev.target.id === 'host-create-form') { ev.preventDefault();await createHost(ev.target); }
    if (ev.target.id === 'team-join-form') { ev.preventDefault();await joinTeam(ev.target); }
  });
  document.addEventListener('input', ev => {
    if (ev.target.id === 'amount-slider') setAmount(ev.target.value, false);
    if (ev.target.id === 'amount-input') {
      const raw = Number(ev.target.value);
      if (ev.target.value !== '' && Number.isFinite(raw)) setAmount(raw, false, true);
    }
  });
  document.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    if (action === 'home') {ev.preventDefault();state.view='home';render();return;}
    if (action === 'go-host') {state.view='host-form';render();return;}
    if (action === 'go-team') {state.view='team-form';render();return;}
    if (action === 'amount') {setAmount(Number(btn.dataset.amount));return;}
    if (action === 'copy-code') {copy(state.room?.code || '');return;}
    if (action === 'copy-link') {copy(`${location.origin}/?join=${encodeURIComponent(state.room?.code || '')}`);return;}
    if (action === 'fullscreen') {
      try {if (!document.fullscreenElement) await document.documentElement.requestFullscreen();else await document.exitFullscreen();}
      catch(e){toast('Trình duyệt không hỗ trợ chế độ toàn màn hình.',true);} return;
    }
    if (action === 'invest') {
      ensureAudio();
      const rawAmount = $('#amount-input')?.value;
      if (rawAmount === '') return toast('Vui lòng nhập số tiền đầu tư.',true);
      const n = Number(rawAmount);
      if (!Number.isFinite(n) || n < 0 || n > 10 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-8) return toast('Số tiền phải từ 0 đến 10, tối đa 2 chữ số thập phân.',true);
      const response = await request('team:invest',{amount:Math.round(n * 100) / 100});
      if (!response.ok) return toast(response.error,true);
      toast(`Đã khóa quyết định ${money(n)} — chờ Host công bố!`);return;
    }
    if (action === 'reveal') {
      const r = state.room;
      if (r.investedCount < r.groupCount && !window.confirm(`Mới có ${r.investedCount}/${r.groupCount} nhóm gửi đầu tư. Bạn vẫn muốn bắt đầu reveal?`))return;
      ensureAudio();
      const response = await request('host:reveal');
      if (!response.ok)toast(response.error,true);
      return;
    }
    if (action === 'close-stage') {state.stageDismissed=true;stage.classList.add('hidden');render();return;}
    if (action === 'show-result') {state.stageDismissed=false;state.stageShown='';syncStage();return;}
    if (action === 'new-project') {
      const title = window.prompt('Tên dự án tiếp theo (ngân sách mỗi nhóm reset về $10M):','THE NEXT BIG IDEA');
      if (title === null) return;
      const response = await request('host:newProject',{title});
      if (!response.ok)toast(response.error,true);else toast('Đã bắt đầu dự án mới. Tất cả nhóm có quỹ $10M mới.');return;
    }
    if (action === 'demo') {
      const response = await request('host:demo');
      if (!response.ok)toast(response.error,true);else toast('Đã thêm 5 nhóm demo với tổng $36M.');return;
    }
    if (action === 'clear-demo') {
      const response = await request('host:clearDemo');
      if (!response.ok)toast(response.error,true);else toast('Đã xóa các nhóm demo.');return;
    }
    if (action === 'export') {exportCSV();return;}
  });
  socket.on('connect', () => {if (state.auth) restore();else restore();});
  socket.on('disconnect', () => {if (state.role)render();toast('Mất kết nối. Đang thử kết nối lại...',true);});
  socket.on('host:snapshot', data => {if (state.role === 'host')applySnapshot(data,'host');});
  socket.on('team:snapshot', data => {if (state.role === 'team')applySnapshot(data,'team');});
  // Public events are intentionally ignored: personalized snapshots carry the correct permissions.
  state.view = state.enteredCode ? 'team-form' : 'home';
  render();
})();
