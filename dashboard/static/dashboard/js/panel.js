(() => {
  // Montos con puntos de miles mientras escribes
  document.addEventListener('input', e => {
    if (!e.target.matches('[data-money]')) return;
    const d = e.target.value.replace(/\D/g, '');
    e.target.value = d ? Number(d).toLocaleString('es-CO') : '';
  });
  document.querySelectorAll('[data-money]').forEach(i => i.dispatchEvent(new Event('input', { bubbles: true })));

  // Confirmación antes de acciones destructivas
  document.addEventListener('submit', e => {
    const msg = e.target.dataset.confirm;
    if (msg && !confirm(msg)) e.preventDefault();
  });

  // Filtros de movimientos: se aplican solos y sin recargar la página.
  // Pide la misma URL al servidor y cambia solo el mes y la lista; si algo
  // falla, cae al comportamiento normal (recarga completa).
  const filters = document.getElementById('filters');
  if (filters) {
    const catSel = document.getElementById('f-cat');
    const tipoSel = filters.elements.tipo;
    const groups = [...catSel.querySelectorAll('optgroup')].map(g => g.cloneNode(true));
    let pending = null;

    // La categoría depende del tipo: gastos → categorías de gasto, etc.
    // Con "transferencias" no hay categoría, así que se oculta.
    const syncCategories = () => {
      const t = tipoSel.value, keep = catSel.value;
      catSel.hidden = t === 'TRANSFER';
      catSel.replaceChildren(catSel.options[0],
        ...groups.filter(g => !t || t === 'TRANSFER' || g.dataset.type === t).map(g => g.cloneNode(true)));
      catSel.value = [...catSel.options].some(o => o.value === keep) ? keep : '';
    };

    const urlFor = () => {
      const q = new URLSearchParams();
      new FormData(filters).forEach((v, k) => { if (v) q.set(k, v); });
      if (tipoSel.value === 'TRANSFER') q.delete('categoria');
      const s = q.toString();
      return location.pathname + (s ? '?' + s : '');
    };

    const load = async (url, push = true) => {
      const results = document.getElementById('results');
      pending?.abort();
      const mine = pending = new AbortController();
      results.classList.add('loading');
      try {
        const r = await fetch(url, { signal: mine.signal, credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } });
        if (!r.ok || r.redirected) throw new Error('respuesta no válida');
        const html = await r.text();
        if (mine !== pending) return;   // llegó tarde: ya hay una petición más nueva
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const next = { results: doc.getElementById('results'), months: doc.getElementById('months') };
        if (!next.results || !next.months) throw new Error('página inesperada');
        results.replaceWith(next.results);
        document.getElementById('months').replaceWith(next.months);
        if (push) history.pushState(null, '', url);
      } catch (e) {
        if (e.name === 'AbortError' || mine !== pending) return;
        location.href = url;   // plan B: recarga normal
      } finally {
        if (mine === pending) document.getElementById('results')?.classList.remove('loading');
      }
    };

    filters.querySelectorAll('[data-autosubmit]').forEach(s => s.addEventListener('change', () => {
      if (s === tipoSel) syncCategories();
      load(urlFor());
    }));
    filters.addEventListener('submit', e => { e.preventDefault(); load(urlFor()); });

    // Flechas de mes (el contenedor se reemplaza, por eso se escucha en el formulario)
    filters.addEventListener('click', e => {
      const a = e.target.closest('a[data-nav]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      load(a.getAttribute('href').replace(/^\?/, location.pathname + '?'));
    });

    // Botón atrás/adelante del navegador: reponer los filtros desde la URL
    addEventListener('popstate', () => {
      const q = new URLSearchParams(location.search);
      tipoSel.value = q.get('tipo') || '';
      filters.elements.cuenta.value = q.get('cuenta') || '';
      syncCategories();
      catSel.value = q.get('categoria') || '';
      load(location.pathname + location.search, false);
    });

    syncCategories();
  }

  // Formulario de movimiento: cambia según sea gasto, ingreso o transferencia
  const f = document.getElementById('tx-form');
  if (f) {
    const cat = document.getElementById('tx-cat'), boxCat = document.getElementById('box-cat');
    const boxDest = document.getElementById('box-dest'), lbl = document.getElementById('lbl-account');
    const all = [...cat.options].map(o => o.cloneNode(true));
    const sync = () => {
      const t = f.querySelector('[name=type]:checked').value;
      const transfer = t === 'TRANSFER';
      boxCat.hidden = transfer; boxDest.hidden = !transfer;
      lbl.textContent = transfer ? 'Cuenta origen' : 'Cuenta';
      cat.replaceChildren(...all.filter(o => o.dataset.type === t).map(o => o.cloneNode(true)));
    };
    f.querySelectorAll('[name=type]').forEach(r => r.addEventListener('change', sync));
    sync();
  }
})();
