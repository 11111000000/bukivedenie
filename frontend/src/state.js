// Minimal app-wide state helper: stores selection and provides event hooks
export const STATE_KEY = '__APP_STATE__'

function _ensure(){
  if(!window[STATE_KEY]) window[STATE_KEY] = { selectedBook: null, selectedFragment: null, selectedWidget: null }
  return window[STATE_KEY]
}

export function getState(){
  return Object.assign({}, _ensure())
}

export function setState(patch){
  const s = _ensure()
  Object.assign(s, patch)
  try{
    window.dispatchEvent(new CustomEvent('app:state', { detail: getState() }))
  }catch(e){ /* ignore */ }
  return getState()
}

export function onState(cb){
  const handler = (ev) => cb(ev.detail)
  window.addEventListener('app:state', handler)
  return () => window.removeEventListener('app:state', handler)
}

export default { getState, setState, onState }
