(() => {
  const root = document.querySelector('.chat');
  const thread = document.getElementById('thread');
  const form = document.getElementById('compose');
  const input = document.getElementById('input');
  const send = document.getElementById('send');
  const csrf = form.querySelector('[name=csrfmiddlewaretoken]').value;
  let accountId = null;

  const scroll = () => { thread.scrollTop = thread.scrollHeight; };
  const add = (text, who) => {
    document.getElementById('hello')?.remove();
    const el = document.createElement('div');
    el.className = 'msg ' + who;
    el.textContent = text;
    thread.appendChild(el);
    scroll();
    return el;
  };

  document.getElementById('accs').addEventListener('click', e => {
    const b = e.target.closest('.acc'); if (!b) return;
    const on = b.getAttribute('aria-pressed') === 'true';
    document.querySelectorAll('.acc').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(!on));
    accountId = on ? null : b.dataset.id;
    input.focus();
  });

  document.getElementById('tips').addEventListener('click', e => {
    if (!e.target.classList.contains('tip')) return;
    input.value = e.target.textContent; input.focus();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = ''; send.disabled = true;
    add(text, 'me');
    const wait = add('…', 'bot');
    try {
      const r = await fetch(root.dataset.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify({ text, account_id: accountId }),
      });
      const d = await r.json();
      wait.textContent = d.reply || d.error || 'No pude procesar eso.';
    } catch { wait.textContent = 'Sin conexión. Inténtalo de nuevo.'; }
    send.disabled = false; input.focus(); scroll();
  });
  scroll();
})();
