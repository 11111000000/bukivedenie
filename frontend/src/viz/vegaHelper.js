import embed from 'vega-embed'

export async function renderSpec(el, spec, options = {}){
  if(!el){
    console.error('renderSpec: missing container element', spec)
    return Promise.reject(new Error('renderSpec: container element is null'))
  }
  try{
    return await embed(el, spec, { actions:false, renderer:'canvas', ...options })
  }catch(e){
    console.error('vega-embed failed', e)
    throw e
  }
}
