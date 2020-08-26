declare namespace browser.windowsExt {
	type WindowNative = {
		handle: string
	}
	function getNative(id: number): Promise<WindowNative>;
}