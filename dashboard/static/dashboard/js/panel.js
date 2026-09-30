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

  // Filtros que se aplican solos
  document.querySelectorAll('[data-autosubmit]').forEach(s => s.addEventListener('change', () => s.form.submit()));

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
