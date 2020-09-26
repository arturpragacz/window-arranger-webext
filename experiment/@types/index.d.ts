declare namespace browser.windowsExt {
	interface WindowNative {
		handle: string
	}
	function getNative(id: number): Promise<WindowNative>;
}