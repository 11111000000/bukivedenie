import embed from 'vega-embed'

export function renderSpec(el, spec, options={}){
  return embed(el, spec, { actions:false, renderer:'canvas', ...options })
}
