export const ALL_DECKS = 'all'

export const initialUiState = {
  selectedTabId: null,
  selectedGroupId: null,
  editingTabId: null,
  editingGroupId: null,
  editingStructure: false,
  colorGroupId: null,
  editingCardId: null,
  addingMode: null,
  studyMode: 'alternating',
  studyModeContext: null,
  cardFilter: 'all',
  reservedBottomSpace: 0,
}

export function uiReducer(state, action) {
  switch (action.type) {
    case 'PATCH':
      return { ...state, ...action.value }
    case 'SELECT_TAB':
      return {
        ...state,
        selectedTabId: action.tabId,
        selectedGroupId: null,
        editingGroupId: null,
        editingCardId: null,
        addingMode: null,
        studyModeContext: null,
        cardFilter: 'all',
        reservedBottomSpace: 0,
      }
    case 'SELECT_GROUP':
      return {
        ...state,
        selectedGroupId: state.selectedGroupId === action.groupId ? null : action.groupId,
        editingCardId: null,
        addingMode: null,
        studyModeContext: null,
        cardFilter: 'all',
        reservedBottomSpace: 0,
      }
    case 'FOCUS_GROUP':
      return {
        ...state,
        selectedGroupId: action.groupId,
        editingCardId: null,
        addingMode: null,
        studyModeContext: null,
        cardFilter: 'all',
        reservedBottomSpace: 0,
      }
    case 'TOGGLE_ALL_DECKS':
      return {
        ...state,
        selectedGroupId: state.selectedGroupId === ALL_DECKS ? null : ALL_DECKS,
        editingCardId: null,
        addingMode: null,
        studyModeContext: null,
        cardFilter: 'all',
        reservedBottomSpace: 0,
      }
    case 'CLOSE_CARD_EDITORS':
      return { ...state, addingMode: null, editingCardId: null }
    case 'TOGGLE_STRUCTURE_EDITING':
      return {
        ...state,
        editingStructure: !state.editingStructure,
        editingTabId: null,
        editingGroupId: null,
        colorGroupId: null,
        editingCardId: null,
        addingMode: null,
      }
    default:
      return state
  }
}
