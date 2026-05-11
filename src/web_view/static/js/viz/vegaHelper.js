export async function renderSpec(el, spec, options={}){
  if(window.vegaEmbed){
    return window.vegaEmbed(el, spec, { actions:false, renderer:'canvas', ...options })
  }
  // fallback to dynamic import if bundled (not in CDN mode)
  const m = await import('https://cdn.jsdelivr.net/npm/vega-embed@6?module')
  return m.default(el, spec, { actions:false, renderer:'canvas', ...options })
}
