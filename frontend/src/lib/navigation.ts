/** Router state for links to a detail page, so its back link returns to the right view. */
export interface BackState {
  back?: { to: string; label: string };
}
