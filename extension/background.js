// Clicking the toolbar icon (or Alt+Shift+A) opens Student Agenda in the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});
