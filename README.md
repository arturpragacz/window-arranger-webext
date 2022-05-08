# Window Arranger

With the help of programs like [7+ Taskbar Tweaker](https://rammichael.com/7-taskbar-tweaker) you can easily reorder your browser windows (just the same as windows from any other program). Unfortunately, after you restart your browser, the order of windows will not be restored, requiring you to manually order them back. This is cumbersome, especially when you have many browser windows opened.

This Webextension solves the problem, by saving the order of windows inside the browser memory and restoring it after the browser restart.

[![Window Arranger presentation](https://img.youtube.com/vi/Lrxn4mD0iqo/0.jpg)](https://youtu.be/Lrxn4mD0iqo)

## Installation

This extension is available on Windows operating system only. It does not support Windows 11.

You will need [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) or [Firefox Nightly](https://www.mozilla.org/en-US/firefox/nightly/). Other Firefox releases do not allow unsigned extensions to be installed.

1. Download the latest version of the extension and application from the [releases](https://github.com/pragacz/window-arranger-webext/releases/).
2. Unpack the zip archive.
3. Run the `register_native.ps1` Powershell script. If you've never run Powershell scripts before, you may need to [set a correct execution policy](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-executionpolicy?view=powershell-7#example-1--set-an-execution-policy), for example by running a Powershell command:

	`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine`
4. Go to `about:config` in your browser and set the pref `xpinstall.signatures.required` to `false` and `extensions.experiments.enabled` to `true`.
5. Go to `about:addons` and choose 'Install addon from file' from the cog menu in the top right, then browse to the xpi file you downloaded. The browser will ask for a permission to install.

## Usage

If you configured everything correctly, the Webextension should start the Native Application automatically.

Every couple seconds the Webextension will communicate with the Native Application and save the current order of the browser windows in the browser memory.

When you restart the browser, the Webextension will automatically restore the windows order last saved before the browser exit.
