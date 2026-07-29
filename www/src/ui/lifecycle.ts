/** A BFCache page remains live and must keep its listeners for the later `pageshow` restore. */
export function shouldDisposeOnPageHide( event: Pick<PageTransitionEvent, "persisted"> ): boolean {
	return !event.persisted;
}
