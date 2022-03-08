# Window Arranger

With the help of programs like [7+ Taskbar Tweaker](https://rammichael.com/7-taskbar-tweaker) you can easily reorder your browser windows (just the same as windows from any other program). Unfortunately, after you restart your browser, the order of the windows will not be restored, requiring you to manually order them back. This is cumbersome, especially when you have many browser windows opened.

This Webextension solves this problem, by saving the order of the windows inside the browser memory and allowing you to restore it with the press of a single button.

## Installation

This extension is available on Windows operating system only.

You will need [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) or [Firefox Nightly](https://www.mozilla.org/en-US/firefox/nightly/). Other Firefox releases do not allow unsigned extensions to be installed.

1. Install [Window Arranger Native](https://github.com/pragacz/window-arranger-native/#installation).
2. Go to `about:config` and set the pref `xpinstall.signatures.required` to `false` and `extensions.experiments.enabled` to `true`.
3. Download the latest version of the extension from the [releases](https://github.com/pragacz/window-arranger-webext/releases/).
4. Go to `about:addons` and choose 'Install addon from file' from the cog menu in the top right, then browse to the xpi file you just downloaded. The browser will ask for a permission to install.

## Usage

If you configured everything correctly, the Webextension should start the Native Application automatically.

Every couple seconds the Webextension will communicate with the Native Application and save the current order of the browser windows in the browser memory.

When you restart the browser, simply open the Webextension popup (by clicking the icon) and then click on `Restore previous` to restore the order last saved before the browser exit.

## Dependencies

- [Lodash](https://lodash.com/)
