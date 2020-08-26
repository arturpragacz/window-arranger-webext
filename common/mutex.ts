export class Mutex {
	private mutex = Promise.resolve();

	lock(): PromiseLike<() => void> {
		let begin: (unlock: () => void) => void = unlock => {};

		this.mutex = this.mutex.then(() => {
			return new Promise(begin);
		});

		return new Promise(res => {
			begin = res;
		});
	}

	dispatchCount = 0;

	async dispatch<T>(fn: (() => PromiseLike<T>) | (() => T), name?: string): Promise<T> {
		this.dispatchCount += 1;
		let id = this.dispatchCount;
		if (name != undefined)
			console.debug(id + ": " + name + " requesting lock.");
		const unlock = await this.lock();
		if (name != undefined)
			console.debug(id + ": " + name + " granted lock.");
		try {
			return await Promise.resolve(fn());
		} catch (e) {
			if (name != undefined)
				console.debug(id + ": " + name + " rejected with: " + e);
			throw e;
		} finally {
			if (name != undefined)
				console.debug(id + ": " + name + " releasing lock.");
			unlock();
		}
	}
}