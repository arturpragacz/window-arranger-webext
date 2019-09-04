"use strict";

// const { utils: Cu , classes: Cc, interfaces: Ci} = Components;

// const globalMessageManager = Cc["@mozilla.org/globalmessagemanager;1"].getService();

// const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
// const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

//ChromeUtils.import("resource://gre/modules/Timer.jsm");

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

this.windowsExtended = class extends ExtensionAPI {
	getAPI(context) {
    let { extension } = context;
		const { windowManager } = extension;
		
		return {
			windowsExt: {
			  getNative(windowId) {
					let win = windowManager.get(windowId, context);
					if (!win) {
				  	return Promise.reject({
							message: `Invalid window ID: ${windowId}`,
				  	});
					}
					let baseWindow = win.window.docShell.treeOwner
						.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIBaseWindow);
					
					return {handle: baseWindow.nativeHandle };
				}
			}
		}
	}
}