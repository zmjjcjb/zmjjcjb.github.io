(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* 导航：移动端开合 + 当前区域高亮 */
const nav = $('#navigation'), toggle = $('.menu-toggle');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
});
nav.addEventListener('click', e => { if (e.target.tagName === 'A') { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });
const links = $$('nav a');
const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55%' });
$$('main section[id]').forEach(s => spy.observe(s));

/* 学习方向切换：文案 + 互动场景（开发板 / 示波器 / 赛道小车） */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tracks = {
  embedded: {
    label: 'EMBEDDED SYSTEMS', title: '从点亮一盏灯，<br>到掌控一个系统。',
    description: '从 51 单片机入门，在 STM32 上进阶。让 C 语言走出屏幕，连接传感器、驱动电机，把每一行代码变成看得见的响应。',
    tags: ['51 单片机', 'STM32', 'C 语言', '传感器与通信'],
    route: ['认识电路', '编写程序', '软硬件联调'], board: 'TONGZHOU / DEV BOARD',
    off: 'LED / OFF', on: 'LED / ON ✳', btn: '点亮第一盏灯'
  },
  power: {
    label: 'POWER ELECTRONICS', title: '把电能，<br>驯得服服帖帖。',
    description: '从电源题出发：整流、逆变、拓扑设计。电流的每一次流转背后，都有你亲手算出的参数和焊出的电路。',
    tags: ['电源设计', '电力电子', 'PCB 绘制', '电路调试'],
    route: ['原理分析', '电路搭建', '波形验证'], board: 'TONGZHOU / POWER LAB',
    off: 'VOUT / STANDBY', on: 'VOUT / 5.00V ✓', btn: '上电看波形'
  },
  robot: {
    label: 'SMART CAR & ROBOTICS', title: '给小车一双眼睛，<br>让它自己认路。',
    description: '摄像头识别赛道，PID 控制转向。当算法第一次驱使机械动起来，那种「活了」的感觉，会上瘾。',
    tags: ['循迹与控制', '摄像头识别', '电机驱动', 'PID 调参'],
    route: ['搭建车模', '感知环境', '冲刺赛道'], board: 'TONGZHOU / TRACK MAP',
    off: 'MOTOR / IDLE', on: 'MOTOR / RUN ✳', btn: '启动巡线'
  }
};
let activeTrack = 'embedded';
const tabs = $$('.learning-tabs button');
function stopRover() { try { $('#rover-run').endElement(); } catch {} }
function startRover() { if (reduceMotion) return; try { $('#rover-run').beginElement(); } catch {} }
function setTrack(key) {
  activeTrack = key;
  const t = tracks[key];
  $('#track-label').textContent = t.label;
  $('#track-title').innerHTML = t.title;
  $('#track-description').textContent = t.description;
  $('#track-tags').innerHTML = t.tags.map(s => `<span>${s}</span>`).join('');
  $('#track-route').innerHTML = t.route.map((s, i) => `<span>${s}</span>${i < 2 ? '<b>→</b>' : ''}`).join('');
  $$('.scene').forEach(s => { s.hidden = s.dataset.scene !== key; });
  $('#board-title').textContent = t.board;
  const art = $('#circuit-art');
  art.classList.remove('running');
  $('#board-led').classList.remove('on');
  $('#led-label').textContent = t.off;
  const btn = $('#led-toggle');
  btn.innerHTML = `${t.btn} <span>↗</span>`;
  btn.setAttribute('aria-pressed', 'false');
  stopRover();
  const panel = $('#learning-panel');
  panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
}
tabs.forEach(b => b.addEventListener('click', () => {
  tabs.forEach(x => { x.setAttribute('aria-selected', x === b); x.tabIndex = x === b ? 0 : -1; });
  $('#learning-panel').setAttribute('aria-labelledby', b.id);
  setTrack(b.dataset.track);
}));
/* 场景互动：开发板亮红灯 / 示波器跑波形 / 小车巡线 */
$('#led-toggle').addEventListener('click', () => {
  const t = tracks[activeTrack], art = $('#circuit-art');
  const on = art.classList.toggle('running');
  $('#led-toggle').setAttribute('aria-pressed', on);
  $('#led-label').textContent = on ? t.on : t.off;
  $('#board-led').classList.toggle('on', on);
  const lamp = $('.led-lamp');
  if (lamp) {
    lamp.classList.toggle('on', on);
    lamp.setAttribute('aria-label', on ? '指示灯，已点亮（红光）' : '指示灯，未点亮');
  }
  if (activeTrack === 'robot') { on ? startRover() : stopRover(); }
});
/* 开源学习资料链接（ST 官方文档库） */
$('.inline-link[href="#learn-docs"]')?.addEventListener('click', e => {
  e.preventDefault();
  window.open('https://www.st.com/content/st_com/en/support/learning.html', '_blank', 'noopener');
});

/* 荣誉手风琴：同时只展开一个 */
const honorDetails = $$('.honor-list details');
honorDetails.forEach(d => d.addEventListener('toggle', () => { if (d.open) honorDetails.forEach(o => { if (o !== d) o.open = false; }); }));

/* 滚动入场动画：仅在浏览器支持且未开启"减弱动态效果"时启用，避免内容被永久隐藏 */
if (!reduceMotion && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js');
  const byParent = new Map();
  const targets = $$('.section-kicker,.section-heading,.about-heading>*,.values article,.learning-tabs,.learning-panel,.learning-foot,.competition-feature,.honor-list,.people-heading,.alumni-grid article,.gallery-card,.join-grid>*,.faq');
  const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12, rootMargin: '0px 0px -6%' });
  targets.forEach(el => {
    const group = byParent.get(el.parentElement) ?? byParent.set(el.parentElement, []).get(el.parentElement);
    el.style.setProperty('--rd', `${Math.min(group.length * 90, 360)}ms`);
    group.push(el);
    el.classList.add('reveal');
    io.observe(el);
  });
}

/* 图片放大查看 */
const dialog = $('#image-dialog'), dialogImg = $('#dialog-image'), dialogCap = $('#dialog-caption');
$$('.gallery-card').forEach(c => c.addEventListener('click', () => {
  dialogImg.src = c.dataset.photo;
  dialogImg.alt = c.querySelector('img').alt;
  dialogCap.textContent = c.dataset.caption;
  dialog.showModal();
}));
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

/* 复制群号 */
const toast = $('#toast');
let toastTimer;
function showToast(msg) { toast.textContent = msg; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200); }
$('#copy-qq').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('242947621'); showToast('群号 242947621 已复制 ✓'); }
  catch { showToast('复制失败，请手动输入群号：242947621'); }
});
/* 海报查看 */
$('#poster-open').addEventListener('click', () => {
  dialogImg.src = 'assets/poster.png';
  dialogImg.alt = '2026 同舟学社招新海报';
  dialogCap.textContent = '2026 同舟学社招新海报 · 扫码加入招新群 242947621';
  dialog.showModal();
});
})();
