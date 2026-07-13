export function uniqueNavigationItems(items) {
  const seenIds = new Set();
  const seenRoutes = new Set();
  return items.filter(item => {
    const id = String(item.id || '').trim();
    const route = String(item.route || '').trim();
    if (!id || !route || seenIds.has(id) || seenRoutes.has(route)) return false;
    seenIds.add(id);
    seenRoutes.add(route);
    return true;
  });
}

export function activateOpportunityTab(state, tab) {
  state.opportunityView = tab;
  state.searchStrategyDetail = null;
  state.searchStrategyContextOutdated = false;
  state.searchTaskDetail = null;
  state.searchResultDetail = null;
  state.searchResultEdit = null;
  return state;
}
