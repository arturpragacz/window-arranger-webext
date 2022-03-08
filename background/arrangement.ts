import { CustomIdMaker, CommonIdMaker } from "./observeInfo.js"

export type CommonIdType = number;

type Index = {};
type Group = {};
type GroupIndex = number;

export class Possition {
	group: Group;
	index: Index;
	constructor(group: Group, index: Index) {
		this.group = group;
		this.index = index;
	}

	static copy(position: Possition): Possition {
		return new Possition(position.group, position.index);
	}

	static moveToTop(position: Possition): Possition {
		return new Possition(position.group, 0);
	}
}

class GroupPosition {
	index: GroupIndex;
}

type CustomIdAndPosition<CustomIdName extends string, CustomIdType> = Record<CustomIdName, CustomIdType> & { position: Possition };
type SerializableArrangementWindows<CustomIdName extends string, CustomIdType> = Array<CustomIdAndPosition<CustomIdName, CustomIdType>>;
type SerializableArrangementGroups = Array<[Group, GroupPosition]>;
export class SerializableArrangement<CustomIdName extends string, CustomIdType> {
	windows: SerializableArrangementWindows<CustomIdName, CustomIdType>;
	groups: SerializableArrangementGroups;

	// constructor assumes proper <groups> structure (including all and only those groups present in <windows>)
	constructor(windows: SerializableArrangementWindows<CustomIdName, CustomIdType>, groups: SerializableArrangementGroups) {
		this.windows = windows;
		this.groups = groups;
	}
}

type ArrangementWindows = Map<CommonIdType, Possition>
class ArrangementGroups extends Array<{ group: Group, position: GroupPosition }> {
	has(group: Group): boolean {
		for (const val of this)
			if (_.isEqual(group, val.group))
				return true;
		return false;
	}

	get(group: Group): GroupPosition {
		for (const val of this)
			if (_.isEqual(group, val.group))
				return val.position;
	}

	set(group: Group, position: GroupPosition): void {
		this.delete(group);
		this.push({ group, position });
	}

	// does nothing if group already exists
	insert(group: Group, position: GroupPosition): void {
		let found = false;
		for (const val of this) {
			if (_.isEqual(group, val)) {
				found = true;
				break;
			}
		}
		if (!found) {
			this.push({ group, position });
		}
	}

	delete(group: Group): boolean {
		let found = false;
		let index = -1;
		for (const val of this) {
			index += 1;
			if (_.isEqual(group, val)) {
				found = true;
				break;
			}
		}
		if (found) {
			this.splice(index, 1);
		}
		return found;
	}

	normalize(minPos?: GroupIndex): void {
		this.sort(({ position: pos1 }, { position: pos2 }) => pos1.index - pos2.index);
		let index = Number.POSITIVE_INFINITY;
		if (typeof minPos !== 'undefined')
			index = minPos;
		else if (this.length)
			index = this[0].position.index;
		for (const val of this) {
			val.position.index = index;
			index += 1;
		}
	}

	getMinIndex() : GroupIndex {
		let minIndex = Number.POSITIVE_INFINITY;
		for (const val of this) {
			minIndex = Math.min(minIndex, val.position.index);
		}
		return minIndex;
	}

	static merge(groups1: ArrangementGroups, groups2: ArrangementGroups): ArrangementGroups {
		let groups = new ArrangementGroups(...groups2);
		for (const val1 of groups1) {
			let found = false;
			for (const val of groups) {
				if (_.isEqual(val1.group, val.group)) {
					found = true;
					break;
				}
			}
			if (!found) {
				groups.push(val1);
			}
		}
		return groups;
	}
}
export class Arrangement {
	windows: ArrangementWindows;
	groups: ArrangementGroups;

	constructor(windows: ArrangementWindows = new Map(), groups: ArrangementGroups = new ArrangementGroups(), checkGroups = true) {
		this.windows = windows;
		if (checkGroups) {
			let initialGroups = groups;
			groups = new ArrangementGroups();
			for (const pos of windows.values()) {
				let group = pos.group;
				if (!groups.has(group)) {
					let groupPos = initialGroups.get(group);
					if (typeof groupPos === 'undefined')
						throw new Error("ArrangementWindows: A window belongs to a group not included in groups!");
					groups.push({ group, position: groupPos });
				}
			}
		}
		this.groups = groups;
	}

	addWindow(id: CommonIdType, pos: Possition, groupPos?: GroupPosition): void {
		if (this.windows.has(id))
			throw new Error("addWindow: Adding non unique window!");
		this.windows.set(id, pos);
		if (typeof groupPos !== 'undefined')
			this.groups.set(pos.group, groupPos);
		else if (!this.groups.has(pos.group))
			throw new Error("addWindow: No group position info when adding window with a new group!");
	}

	deleteWindow(id: CommonIdType): void {
		let group = this.windows.get(id).group;
		this.windows.delete(id);

		for (const pos of this.windows.values()) {
			if (pos.group == group)
				return;
		}
		this.groups.delete(group);
	}

	serialize<CustomIdName extends string, CustomIdType>(customIdName: CustomIdName, customIdMaker: CustomIdMaker<CommonIdType, CustomIdType>)
	:	{ serializableArrangement: SerializableArrangement<CustomIdName, CustomIdType>, idsFailedConversion: Map<CommonIdType, Possition> } {
		let serializableArrangementWindows: SerializableArrangementWindows<CustomIdName, CustomIdType> = [];
		let idsFailedConversion = new Map<CommonIdType, Possition>();

		for (let idPos of this.windows) {
			let position = idPos[1];
			position = Possition.copy(position);

			const commonId = idPos[0];
			const customId: CustomIdType = customIdMaker(commonId);

			if (customId !== undefined) {
				let customIdAndPosition = {} as CustomIdAndPosition<CustomIdName, CustomIdType>;
				customIdAndPosition.position = position;
				let customIdRecord: Record<CustomIdName, CustomIdType> = customIdAndPosition;
				customIdRecord[customIdName] = customId;
				serializableArrangementWindows.push(customIdAndPosition);
			}
			else {
				idsFailedConversion.set(commonId, position);
			}
		}

		let serializableArrangementGroups: SerializableArrangementGroups = this.groups.map(({ group, position }) => [group, position]);

		let serializableArrangement = new SerializableArrangement<CustomIdName, CustomIdType>(serializableArrangementWindows, serializableArrangementGroups);

		return {serializableArrangement: serializableArrangement, idsFailedConversion};
	}

	static deserialize<CustomIdName extends string, CustomIdType>(serializableArrangement: SerializableArrangement<CustomIdName, CustomIdType>, customIdName: CustomIdName,
	commonIdMaker: CommonIdMaker<CommonIdType, CustomIdType>): { arrangement: Arrangement, idsFailedConversion: Map<CustomIdType, Possition> } {
		let windows: ArrangementWindows = new Map();
		let idsFailedConversion = new Map<CustomIdType, Possition>();

		for (let posWindow of serializableArrangement.windows) {
			let position = posWindow.position;
			position = Possition.copy(position);

			const customId = posWindow[customIdName];
			const commonId: CommonIdType = commonIdMaker(customId);

			if (commonId !== undefined) {
				windows.set(commonId, position);
			}
			else {
				idsFailedConversion.set(customId, position);
			}
		}

		let groups: ArrangementGroups = new ArrangementGroups(...serializableArrangement.groups.map(([group, position]) => ({ group, position })));

		let arrangement = new Arrangement(windows, groups, false)

		return {arrangement, idsFailedConversion};
	}
}

export function mergeArrangements(arr1: Arrangement, arr2: Arrangement): Arrangement {
	let windows: ArrangementWindows = new Map(function*() { yield* arr1.windows; yield* arr2.windows; }())
	let groups = ArrangementGroups.merge(arr1.groups, arr2.groups);
	return new Arrangement(windows, groups);
}
