// Zone store keys are the delivered zone ids ('alerts', 'work_order', 'steps', 'actions', 'history'). The shell does not invent
// its own: a zone's key is what the context object calls it.
export { ZONE_IDS, isZoneId as isKnownZoneKey } from '@/contracts';
