interface Array<T> {
	/**
	* Performs the specified action for each element in an array in an asynchronous way.
	* @param callbackfn A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
	* @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncForEach(callbackfn: (value: T, index: number, array: T[]) => Promise<void>, thisArg?: any): Promise<void>;
	/**
	* Returns the elements of an array that meet the condition specified in an asynchronous callback function.
	* @param callbackfn A function that accepts up to three arguments. The filter method calls the callbackfn function one time for each element in the array.
	* @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncFilter(callbackfn: (value: T, index: number, array: ReadonlyArray<T>) => Promise<unknown>, thisArg?: any): Promise<T[]>;
	/**
	* Calls a defined asynchronous callback function on each element of an array, and returns an array that contains the results.
	* @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
	* @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
	*/
	asyncMap<U>(callbackfn: (value: T, index: number, array: T[]) => Promise<U>, thisArg?: any): Promise<U[]>;
}

if (!Array.prototype.asyncForEach) {
	Array.prototype.asyncForEach = async function (callback, thisArg) {
		for (let i = 0; i < this.length; ++i) {
			await callback.call(thisArg, this[i], i, this);
		}
	};
}

if (!Array.prototype.asyncFilter) {
	Array.prototype.asyncFilter = async function (callback, thisArg) {
		const filtered = [];
		for (let i = 0; i < this.length; ++i) {
			if (await callback.call(thisArg, this[i], i, this))
				filtered.push(this[i]);
		}
		return filtered;
	};
}

if (!Array.prototype.asyncMap) {
	Array.prototype.asyncMap = async function (callback, thisArg) {
		const mapped = [];
		for (let i = 0; i < this.length; ++i) {
			mapped.push(await callback.call(thisArg, this[i], i, this));
		}
		return mapped;
	};
}