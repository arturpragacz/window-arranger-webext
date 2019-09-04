class Possition {
	inDefaultGroup: boolean;
	group: any;
	index: any;
	constructor(inDefaultGroup, group, index) {
		this.inDefaultGroup = inDefaultGroup;
		this.group = group;
		this.index = index;
	}

	moveToTop() {
		return new Possition(this.inDefaultGroup, this.group, 0);
	}
}

class Arrangement extends Map<number, Possition> {

}

class ObserveInfo {
	public deleteFromObserved: (number | string)[] = [];
	public addToObserved: (number | string)[] = [];

	add(ids) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.addToObserved.push(...ids);
		return this;
	}

	delete(ids) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		this.deleteFromObserved.push(...ids);
		return this;
	}
}

declare namespace browser.windowsExt {
	function getNative(id: number): Promise<{handle: string}>;
}

(function(w) {

	let appName = "window_arranger";
	let port: browser.runtime.Port;
	let runningConnection = false;
	let messageIdCounter = 1;
	let observed = new Map<number, String>(); // from ids to handles
	let observedInverse = new WeakMap<String, number>(); // from handles to ids

	class Message {
		source: string;
		id: number;
		type: string;
		value: any;
		constructor(source, id, type, value) {
			this.source = source;
			this.id = id;
			this.type = type;
			this.value = value;
		}
	}

	interface ResponseMessage extends Message {
		status: string;
	}

	function parseEscribedArrangement(escribedArrangement: {handle: string, position: Possition}[]): Arrangement {
		let arrangement: Arrangement;

		for (let posWindow of escribedArrangement) {
			Object.setPrototypeOf(posWindow.position, Possition.prototype);
			arrangement.set(observedInverse.get(posWindow.handle), posWindow.position);
		}

		return arrangement;
	}

	function toEscribedArrangement(arrangement: Arrangement): {handle: string, position: Possition}[] {
		let escribedArrangement: {handle: string, position: Possition}[] = [] ;

		for (let posId of arrangement) {
			let id = posId[0];
			let handle: string = observed.get(id).toString();
			if (handle != undefined) {
				escribedArrangement.push({ handle, position: posId[1] });
			}
		}

		return escribedArrangement;
	}

	function sendMessage(type: string, value: any) {
		return new Promise(function (resolve, reject) {
			let messageId = messageIdCounter++;
			port.onMessage.addListener(function callback(response: ResponseMessage) {
				if (response.source === "browser" && response.id === messageId && response.type === "response") {
					port.onMessage.removeListener(callback);
					if (response.status === "OK" && "value" in response) {
						resolve(response.value);
					}
				}
			});
			port.postMessage(new Message("browser", messageId, type, value));
		});
	}

  async function changeObserved(observeInfo: ObserveInfo): Promise<Arrangement> {
		observeInfo.deleteFromObserved.forEach(function(id: number, index, array) {
			let handle: string = observed.get(id).toString();
			if (handle == undefined) {
				array[index] = undefined;
			}
			else {
				array[index] = handle;
				observed.delete(id);
			}
		});
		observeInfo.deleteFromObserved = observeInfo.deleteFromObserved.filter(x => x != undefined);

		observeInfo.addToObserved.forEach(function(id: number, index, array) {
			browser.windowsExt.getNative(id)
			.then(({ handle }) => {
				array[index] = handle;
				let boxedHandle = new String(handle);
				observed.set(id, boxedHandle);
				observedInverse.set(boxedHandle, id);
			})
			.catch(e => {
				array[index] = undefined;
			})
		});
		observeInfo.addToObserved = observeInfo.addToObserved.filter(x => x != undefined);

		return parseEscribedArrangement(await sendMessage("changeObserved", observeInfo) as
			{handle: string, position: Possition}[]);
	}

  async function getArrangement(idArray: number[]): Promise<Arrangement> {
		let filterHandles = true;
		if (idArray === undefined) {
			filterHandles = false;
		}
		
		let value: string | string[];
		if (filterHandles) {
			let handleArray: string[] = [];
			for (let id of idArray) {
				let handle: string = observed.get(id).toString();
				if (handle != undefined) {
					handleArray.push(handle);
				}
			}
			value = handleArray;
		}
		else {
			value = "all";
		}

		return parseEscribedArrangement(await sendMessage("getArrangement", value) as
			{handle: string, position: Possition}[]);
	}

	function setArrangement(arrangement) {
		return sendMessage("setArrangement", toEscribedArrangement(arrangement));
	}

	let onArrangementChanged = new EventTarget();
	function handleMessageFromApp(message: ResponseMessage) {
		console.log(message);
		if (message.status === "OK" && message.type === "arrangementChanged") {
			let event = new CustomEvent(message.type, message.value);
			onArrangementChanged.dispatchEvent(event);
		}
	}

	function startConnection() {
		if (!runningConnection) {
			port = browser.runtime.connectNative(appName);
			port.onMessage.addListener((message: ResponseMessage) => {
				if (message.source === "app") {
					handleMessageFromApp(message);
				}
			});
			runningConnection = true;
			messageIdCounter = 1;
		}
		else
			console.log("Connection already running!");
	}

	function stopConnection() {
		if (runningConnection) {
			port.disconnect();
			runningConnection = false;
		}
		else
			console.log("No running connection!");
	}

	w['arranger'] = {
		changeObserved,
		getArrangement,
		setArrangement,
		onArrangementChanged,
		startConnection,
		stopConnection,//TODO usuń sendmessage
		sendMessage,
	}
})(window);
