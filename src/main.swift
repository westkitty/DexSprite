import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Setup Window with standard resizable native titlebar for easy dragging, closing, and resizing
        let mask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1300, height: 880), styleMask: mask, backing: .buffered, defer: false)
        window.center()
        window.title = "Dex Sprite"
        window.isReleasedWhenClosed = false
        window.makeKeyAndOrderFront(nil)

        // Programmatically set Dock icon to bypass macOS Launch Services cached icon issues
        if let iconPath = Bundle.main.path(forResource: "AppIcon", ofType: "icns") {
            if let image = NSImage(contentsOfFile: iconPath) {
                NSApp.applicationIconImage = image
            }
        }

        // WKWebView configuration
        let config = WKWebViewConfiguration()
        
        // Inject JS flag to identify native macOS App environment
        let script = WKUserScript(source: "window.isNativeApp = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        config.userContentController.addUserScript(script)
        
        // Register export message handler bridge
        config.userContentController.add(self, name: "exportFile")
        
        // Configure preferences
        config.preferences.setValue(true, forKey: "developerExtrasEnabled") // Enable Web Inspector / Developer Tools on right click!
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        window.contentView = webView

        // Load index.html from app resources www directory
        if let wwwURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            let parentDir = wwwURL.deletingLastPathComponent()
            webView.loadFileURL(wwwURL, allowingReadAccessTo: parentDir)
        }
        
        setupMenuBar()
    }

    func setupMenuBar() {
        let mainMenu = NSMenu()
        
        // 1. App Menu (Dex Sprite)
        let appMenuItem = NSMenuItem(title: "Dex Sprite", action: nil, keyEquivalent: "")
        mainMenu.addItem(appMenuItem)
        
        let appMenu = NSMenu(title: "Dex Sprite")
        appMenuItem.submenu = appMenu
        
        // Standard About
        appMenu.addItem(withTitle: "About Dex Sprite", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        
        // Standard Hide
        appMenu.addItem(withTitle: "Hide Dex Sprite", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        
        // Hide Others
        let hideOthersItem = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthersItem.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthersItem)
        
        // Show All
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        
        // Standard Quit (Cmd+Q)
        appMenu.addItem(withTitle: "Quit Dex Sprite", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        
        // 2. Edit Menu (Crucial for Copy, Paste, Cut, Undo, Select All inside WKWebView)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        
        editMenu.addItem(withTitle: "Undo", action: NSSelectorFromString("undo:"), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: NSSelectorFromString("redo:"), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: NSSelectorFromString("cut:"), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: NSSelectorFromString("copy:"), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: NSSelectorFromString("paste:"), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: NSSelectorFromString("selectAll:"), keyEquivalent: "a")
        
        // 3. Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        
        NSApp.mainMenu = mainMenu
    }
    
    // Support file download delegation
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, preferences: WKWebpagePreferences, decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download, preferences)
        } else {
            decisionHandler(.allow, preferences)
        }
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.canShowMIMEType {
            decisionHandler(.allow)
        } else {
            decisionHandler(.download)
        }
    }
    
    // Download handlers
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }
    
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }
    
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        // Show native Save Panel!
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = suggestedFilename
        savePanel.begin { result in
            if result == .OK {
                completionHandler(savePanel.url)
            } else {
                completionHandler(nil)
            }
        }
    }
    
    // Handle standard HTML file open panels in WKWebView (e.g. file uploads)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let openPanel = NSOpenPanel()
        openPanel.allowsMultipleSelection = parameters.allowsMultipleSelection
        openPanel.canChooseDirectories = false
        openPanel.canChooseFiles = true
        
        if let window = webView.window {
            openPanel.beginSheetModal(for: window) { response in
                if response == .OK {
                    completionHandler(openPanel.urls)
                } else {
                    completionHandler(nil)
                }
            }
        } else {
            openPanel.begin { response in
                if response == .OK {
                    completionHandler(openPanel.urls)
                } else {
                    completionHandler(nil)
                }
            }
        }
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "exportFile",
              let body = message.body as? [String: Any],
              let filename = body["filename"] as? String,
              let base64Data = body["base64"] as? String,
              let data = Data(base64Encoded: base64Data) else {
            return
        }
        
        DispatchQueue.main.async {
            let savePanel = NSSavePanel()
            savePanel.nameFieldStringValue = filename
            savePanel.begin { result in
                if result == .OK, let url = savePanel.url {
                    do {
                        try data.write(to: url)
                    } catch {
                        print("Error writing exported file: \(error)")
                    }
                }
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// Entry point
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
