'use strict';

function nextStep(state, event) {
  const order = ['scan', 'confirmItem', 'checklist', 'photos', 'grade', 'signature', 'review'];
  if (event === 'offline') return { ...state, offline: true };
  if (event === 'back') {
    const i = Math.max(0, order.indexOf(state.step) - 1);
    return { ...state, step: order[i] };
  }
  const i = order.indexOf(state.step);
  if (state.step === 'photos' && (state.photos || []).length < (state.minPhotos || 1)) {
    return { ...state, error: 'PHOTO_REQUIREMENT_NOT_MET' };
  }
  return { ...state, step: order[Math.min(order.length - 1, i + 1)], error: null };
}

module.exports = { nextStep };
