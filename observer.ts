
type CommonIdType = number;
type CustomIdType = string;
type IdType = CommonIdType | CustomIdType;

class ObserveInfo<T extends IdType> {
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
}

type CustomIdMaker = (commonId: CommonIdType) => Promise<CustomIdType>;
type CommonIdMaker = (customId: CustomIdType) => CommonIdType;

interface Array<T> {
	/**
	* Performs the specified action for each element in an array in an asynchronous way.
	* @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
	* @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncForEach(callbackfn: (value: T, index: number, array: T[]) => Promise<void>, thisArg?: any): Promise<void>;
}

if (!Array.prototype.asyncForEach) {
	Array.prototype.asyncForEach = async function (callback, thisArg) {
		for (var i = 0; i < this.length; ++i) {
			await callback.call(thisArg, this[i], i, this);
		}
	};
}

class Observer {
	private observed = new Map<CommonIdType, CustomIdType>(); // from ids to customIds
	private observedInverse = new Map<CustomIdType, CommonIdType>(); // from customIds to ids

	async changeObserved(observeInfo: ObserveInfo<CommonIdType>,
	customIdMakerDel: CustomIdMaker = this.asyncGetCustomId, //.bind(this),
	customIdMakerAdd: CustomIdMaker = this.asyncGetCustomId, //.bind(this),
	commonIdMaker: CommonIdMaker = this.getCommonId) //.bind(this))
	: Promise<ObserveInfo<CustomIdType>> {

		customIdMakerDel = customIdMakerDel.bind(this);
		customIdMakerAdd = customIdMakerAdd.bind(this);
		commonIdMaker = commonIdMaker.bind(this);

		let newObserveInfo = new ObserveInfo(observeInfo);
		await newObserveInfo.deleteFromObserved.asyncForEach(async (commonId: CommonIdType, index, array) => {
			let customId: CustomIdType = await customIdMakerDel(commonId).catch(() => undefined); // TODO: why would you ever use a custom one?
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				(array[index] as any) = customId; // HACK!
				this.observed.delete(commonId);
				this.observedInverse.delete(customId);
			}
		});
		// newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);

		await newObserveInfo.addToObserved.asyncForEach(async (commonId: CommonIdType, index, array) => {
			let customId: CustomIdType = await customIdMakerAdd(commonId).catch(() => undefined);
			if (customId === undefined) {
				array[index] = undefined;
			}
			else {
				(array[index] as any) = customId; // HACK!
				this.observed.set(commonId, customId);
				this.observedInverse.set(customId, commonId);
			}
		});
		// newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

		return newObserveInfo as any; // HACK!
	}

	async asyncGetCustomId(commonId: CommonIdType): Promise<CustomIdType> {
		return this.getCustomId(commonId);
	}

	getCustomId(commonId: CommonIdType): CustomIdType {
		return this.observed.get(commonId);
	}

	getCommonId(customId: CustomIdType): CommonIdType {
		return this.observedInverse.get(customId);
	}
}