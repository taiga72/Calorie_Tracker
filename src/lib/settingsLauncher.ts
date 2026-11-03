/**
 * Opens Settings at a section from anywhere (e.g. "Edit" on the goal plan
 * card in Statistics). The app listens for the event, switches to Settings
 * and tells it which section to show.
 */
export type SettingsSection = 'goalPlan';
export const OPEN_SETTINGS_EVENT = 'cc:open-settings';

export function openSettings(section: SettingsSection): void {
  window.dispatchEvent(new CustomEvent<SettingsSection>(OPEN_SETTINGS_EVENT, { detail: section }));
}
