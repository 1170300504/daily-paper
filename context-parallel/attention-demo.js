(() => {
  const root = document.getElementById('cp-attention-explainer');
  const partition = root.querySelector('#cp-partition');
  const matrix = root.querySelector('#cp-matrix');
  const state = root.querySelector('#cp-state');
  const description = root.querySelector('#cp-description');
  const buttons = Array.from(root.querySelectorAll('[data-gpu]'));
  const partitions = {
    contiguous: [[1, 2], [3, 4], [5, 6], [7, 8]],
    headtail: [[1, 8], [2, 7], [3, 6], [4, 5]]
  };
  let selectedGpu = 3;
  const add = (text, className) => {
    const cell = document.createElement('div');
    cell.className = className;
    cell.textContent = text;
    cell.setAttribute('aria-hidden', 'true');
    matrix.appendChild(cell);
  };
  function render() {
    const groups = partitions[partition.value];
    const selectedQueries = groups[selectedGpu];
    const owner = token => groups.findIndex(group => group.includes(token));
    const work = selectedQueries.reduce((total, token) => total + token, 0);
    const remoteOwners = [...new Set(Array.from({length: Math.max(...selectedQueries)}, (_, i) => owner(i + 1)))].filter(gpu => gpu !== selectedGpu);
    const remoteText = remoteOwners.length ? `其中包含 ${remoteOwners.map(gpu => `GPU${gpu}`).join('、')} 持有的 K/V` : '当前所需 K/V 均在本卡';
    state.textContent = `GPU${selectedGpu} · Q 位置 ${selectedQueries.join(', ')} · 有效 QK 对 ${work}`;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.gpu) === selectedGpu)));
    matrix.replaceChildren();
    add('KV卡', 'cp-label cp-owner text-small');
    for (let token = 1; token <= 8; token++) add(`G${owner(token)}`, 'cp-label cp-owner text-small');
    add('Q ↓', 'cp-label cp-column');
    for (let token = 1; token <= 8; token++) add(String(token), 'cp-label cp-column');
    for (let query = 1; query <= 8; query++) {
      const isLocal = selectedQueries.includes(query);
      add(String(query), `cp-label cp-row-label${isLocal ? ' cp-selected-row' : ''}`);
      for (let key = 1; key <= 8; key++) {
        const masked = key > query;
        const active = !masked && isLocal;
        add(masked ? '×' : active ? '●' : '', `cp-cell${masked ? ' cp-masked' : active ? ' cp-active' : ' cp-idle'}`);
      }
    }
    const allWork = groups.map((group, gpu) => `GPU${gpu} 的 Q 位置是 ${group.join('、')}，有效 QK 对为 ${group.reduce((a, b) => a + b, 0)}`).join('；');
    description.textContent = `8 个 token 的因果注意力矩阵。行是 Q 位置，列是 K/V 位置，顶部 G0 到 G3 表示 K/V 原属的 GPU。每个 Q 只能查看自身及之前的位置，右上三角被遮罩。当前 GPU${selectedGpu} 负责 Q 位置 ${selectedQueries.join('、')}，共计算 ${work} 个有效 QK 对，需要使用这些行中可见的全部 K/V，${remoteText}。${allWork}。`;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    selectedGpu = Number(button.dataset.gpu);
    render();
  }));
  partition.addEventListener('change', render);
  render();
})();
