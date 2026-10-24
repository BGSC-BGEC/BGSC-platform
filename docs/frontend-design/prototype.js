/* Plain browser interactions only. No requests, token storage, or API calls. */
document.getElementById('outline-toggle')?.addEventListener('click',()=>document.body.classList.toggle('layout-outlines'));
document.getElementById('catalog-search')?.addEventListener('input',event=>{
  const term=event.target.value.trim().toLowerCase();
  document.querySelectorAll('.catalog-link').forEach(link=>{link.hidden=!link.dataset.search.includes(term);});
});
document.querySelectorAll('[data-local-action]').forEach(button=>button.addEventListener('click',()=>{
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=button.dataset.localAction+' — layout demonstration only.';
  toast.classList.add('visible');
  window.setTimeout(()=>toast.classList.remove('visible'),2400);
}));
