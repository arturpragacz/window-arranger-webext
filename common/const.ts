export enum RunningState {
	NOT_RUNNING,
	RUNNING,
	STARTING,
	STOPPING
}

export interface InternalMessage {
	type: string,
	value: any
}