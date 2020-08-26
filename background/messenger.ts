import { ObserveInfo, ObservedIdMapper } from "./observeInfo.js"
import { CommonIdType, CustomIdArrangement, Arrangement } from "./arrangement.js"

type HandleType = string;
const CustomIdName = "handle";
type CustomIdName = typeof CustomIdName;

let appName = "window_arranger";
let port: browser.runtime.Port;
let runningConnection = false;
let messageIdCounter: number;
let observedIdMapper: ObservedIdMapper<CommonIdType, HandleType>;

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
		console.debug(this);
	}
}

interface ResponseMessage extends Message {
	status: string;
}

async function sendMessage(type: "changeObserved", value: ObserveInfo<HandleType>): Promise<CustomIdArrangement<CustomIdName, HandleType>>;
async function sendMessage(type: "getArrangement", value: { handles: string | HandleType[], inObserved: boolean }): Promise<CustomIdArrangement<CustomIdName, HandleType>>;
async function sendMessage(type: "setArrangement", value: CustomIdArrangement<CustomIdName, HandleType>): Promise<CustomIdArrangement<CustomIdName, HandleType>>;
async function sendMessage(type: string, value: any): Promise<any> {
	return new Promise(function (resolve, reject) {
		let messageId = messageIdCounter++;
		port.onMessage.addListener(function callback(response: ResponseMessage) {
			if (response.source === "browser" && response.id === messageId && response.type === "response") {
				port.onMessage.removeListener(callback);
				console.debug("Response: ", response);
				if (response.status === "OK" && "value" in response) {
					resolve(response.value);
				}
			}
		});
		port.postMessage(new Message("browser", messageId, type, value));
	});
}

export async function changeObserved(observeInfo: ObserveInfo<CommonIdType>): Promise<Arrangement> {
	let newObserveInfo: ObserveInfo<HandleType> = await observedIdMapper.changeObserved(observeInfo,
		async id => (await browser.windowsExt.getNative(id)).handle);
	
	newObserveInfo.deleteFromObserved = newObserveInfo.deleteFromObserved.filter(x => x !== undefined);
	newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

	const {arrangement, idsFailedConversion} = Arrangement.fromCustomId(await sendMessage("changeObserved", newObserveInfo), CustomIdName, observedIdMapper.getCommonId.bind(observedIdMapper));
	if (idsFailedConversion.size > 0)
		console.warn(idsFailedConversion);
	
	return arrangement;
}

export async function getArrangement(idArray?: CommonIdType[], inObserved: boolean = true): Promise<Arrangement> {
	let filterHandles = true;
	if (idArray === undefined) {
		filterHandles = false;
	}
	
	let value: { handles: string | HandleType[], inObserved: boolean };
	let localObservedIdMapper: ObservedIdMapper<CommonIdType, HandleType>;

	if (inObserved) {
		localObservedIdMapper = observedIdMapper;

		if (filterHandles) {
			let handleArray: HandleType[] = [];
			for (let id of idArray) {
				let handle: HandleType = localObservedIdMapper.getCustomId(id);
				
				if (handle !== undefined)
					handleArray.push(handle);
			}
			value.handles = handleArray;
		}
		else {
			value.handles = "all";
		}
	}
	else {
		localObservedIdMapper = new ObservedIdMapper<CommonIdType, HandleType>();

		if (filterHandles) {
			const observeInfo = new ObserveInfo<CommonIdType>().add(idArray);

			let newObserveInfo: ObserveInfo<HandleType> = await localObservedIdMapper.changeObserved(observeInfo,
				async id => (await browser.windowsExt.getNative(id)).handle);
			newObserveInfo.addToObserved = newObserveInfo.addToObserved.filter(x => x !== undefined);

			value.handles = newObserveInfo.addToObserved;
		}
		else {
			throw Error("No idArray provided even though inObserved is false!");
		}
	}

	value.inObserved = inObserved;

	const {arrangement, idsFailedConversion} = Arrangement.fromCustomId(await sendMessage("getArrangement", value), CustomIdName, localObservedIdMapper.getCommonId.bind(localObservedIdMapper));
	if (idsFailedConversion.size > 0)
		console.warn(idsFailedConversion);

	return arrangement;
}

export async function setArrangement(arrangement: Arrangement): Promise<Arrangement> {
	const getCustomId: (commonId: CommonIdType) => HandleType = observedIdMapper.getCustomId.bind(observedIdMapper);
	const {customIdArrangement, idsFailedConversion} = (await arrangement.toCustomId(CustomIdName, getCustomId));
	if (idsFailedConversion.size > 0)
		console.warn(idsFailedConversion);
	
	const responseCustomIdArrangement: CustomIdArrangement<CustomIdName, HandleType> = await sendMessage("setArrangement", customIdArrangement);

	const getCommonId: (customId: HandleType) => CommonIdType = observedIdMapper.getCommonId.bind(observedIdMapper);
	const {arrangement: responseArrangement, idsFailedConversion: responseIdsFailedConversion} = Arrangement.fromCustomId(responseCustomIdArrangement, CustomIdName, getCommonId);
	if (responseIdsFailedConversion.size > 0)
		console.warn(responseIdsFailedConversion);
	
	return responseArrangement;
}

export let onArrangementChanged: EventTarget = new EventTarget();
function handleMessageFromApp(message: ResponseMessage) {
	if (message.status === "OK" && message.type === "arrangementChanged") {
		const value = Arrangement.fromCustomId(message.value, CustomIdName, observedIdMapper.getCommonId.bind(observedIdMapper));
		const event = new CustomEvent(message.type, { detail: value });
		console.debug("From app: ", message);
		onArrangementChanged.dispatchEvent(event);
	}
}

export function startConnection(): void {
	if (!runningConnection) {
		port = browser.runtime.connectNative(appName);
		port.onMessage.addListener((message: ResponseMessage) => {
			if (message.source === "app") {
				handleMessageFromApp(message);
			}
		});
		runningConnection = true;
		messageIdCounter = 1;
		observedIdMapper = new ObservedIdMapper();
	}
	else
		console.warn("Connection already running!");
}

export function stopConnection(): void {
	if (runningConnection) {
		port.disconnect();
		runningConnection = false;
	}
	else
		console.warn("No running connection!");
}
