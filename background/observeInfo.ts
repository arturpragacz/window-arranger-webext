export class ObserveInfo<T> {
	public deleteFromObserved: T[] = [];
	public addToObserved: T[] = [];

	constructor(oi?: ObserveInfo<T>) {
		if (oi !== undefined) {
			this.deleteFromObserved = Array.from(oi.deleteFromObserved);
			this.addToObserved = Array.from(oi.addToObserved);
		}
	}

	add(ids: Array<T> | T) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.addToObserved.push(...ids);
		return this;
	}

	delete(ids: Array<T> | T) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.deleteFromObserved.push(...ids);
		return this;
	}

	isEmpty() {
		return !(this.deleteFromObserved.length || this.addToObserved.length);
	}
}

export type CustomIdMaker<ObserveCommonIdType, ObserveCustomIdType> = (commonId: ObserveCommonIdType) => ObserveCustomIdType;
export type AsyncCustomIdMaker<ObserveCommonIdType, ObserveCustomIdType> = (commonId: ObserveCommonIdType) => Promise<ObserveCustomIdType>;
export type CommonIdMaker<ObserveCommonIdType, ObserveCustomIdType> = (customId: ObserveCustomIdType) => ObserveCommonIdType;

export class ObservedIdMapper<ObserveCommonIdType, ObserveCustomIdType> {
	private observed = new Map<ObserveCommonIdType, ObserveCustomIdType>(); // from ids to customIds
	private observedInverse = new Map<ObserveCustomIdType, ObserveCommonIdType>(); // from customIds to ids

	async changeObserved(observeInfo: ObserveInfo<ObserveCommonIdType>,
	customIdMaker: AsyncCustomIdMaker<ObserveCommonIdType, ObserveCustomIdType>,
	) : Promise<ObserveInfo<ObserveCustomIdType>> {

		let newObserveInfo = new ObserveInfo<ObserveCommonIdType | ObserveCustomIdType>(observeInfo);
		await newObserveInfo.deleteFromObserved.asyncForEach(async (commonId: ObserveCommonIdType, index, array) => {
			let customId: ObserveCustomIdType = this.getCustomId(commonId);
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				array[index] = customId;
				this.observed.delete(commonId);
				this.observedInverse.delete(customId);
			}
		});
		// newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);

		await newObserveInfo.addToObserved.asyncForEach(async (commonId: ObserveCommonIdType, index, array) => {
			let customId: ObserveCustomIdType = await customIdMaker(commonId).catch(() => undefined);
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				array[index] = customId;
				this.observed.set(commonId, customId);
				this.observedInverse.set(customId, commonId);
			}
		});
		// newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

		return newObserveInfo as ObserveInfo<ObserveCustomIdType>; // HACKY
	}

	getCustomId(commonId: ObserveCommonIdType): ObserveCustomIdType {
		return this.observed.get(commonId);
	}

	getCommonId(customId: ObserveCustomIdType): ObserveCommonIdType {
		return this.observedInverse.get(customId);
	}
}