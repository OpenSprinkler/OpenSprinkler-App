//
//  AppDelegate.m
//  Sprinklers
//
//  Created by Samer Albahra on 7/24/14.
//  Copyright (c) 2014 Samer Albahra. All rights reserved.
//

#import "AppDelegate.h"
#import "WebKit/WebPolicyDelegate.h"

@implementation AppDelegate

@synthesize window;
@synthesize webView;

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
}

- (void)awakeFromNib {
    // Enable localStorage in webView
    WebPreferences *prefs = [webView preferences];
    [prefs _setLocalStorageDatabasePath:@"~/Library/Sprinklers/LocalStorage"];
    [prefs setLocalStorageEnabled:YES];
    
    // Get notification when scripting environment becomes available
    [webView setFrameLoadDelegate:self];
    
    // Handle authentication request
    [webView setResourceLoadDelegate:self];
    
    // Get notification on navigation changes (AJAX)
    [webView setPolicyDelegate:self];
    
    // Make webView part of the window's contentView
    [self.window setContentView:self.webView];

    // Load the index.html page
	NSString *resourcesPath = [[NSBundle mainBundle] resourcePath];
	NSString *htmlPath = [resourcesPath stringByAppendingString:@"/index.html"];
	[[webView mainFrame] loadRequest:[NSURLRequest requestWithURL:[NSURL fileURLWithPath:htmlPath]]];
}

// Close the application when the window closes
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender
{
    return YES;
}

// Allow AJAX requests to work
-(void)webView:(WebView *)webView decidePolicyForNewWindowAction:(NSDictionary *)actionInformation request:(NSURLRequest *)request newFrameName:(NSString *)frameName decisionListener:(id <WebPolicyDecisionListener>)listener
{
    [[NSWorkspace sharedWorkspace] openURL:[request URL]];
    [listener ignore];
}

// Function to return the current devices local IP address
-(NSString *) getIPAddress {
    NSArray *addresses = [[NSHost currentHost] addresses];
    NSString *stringAddress = @"error";
    
    for (NSString *anAddress in addresses) {
        if (![anAddress hasPrefix:@"127"] && [[anAddress componentsSeparatedByString:@"."] count] == 4) {
            stringAddress = anAddress;
            break;
        }
    }
    return stringAddress;
}

// This is called as soon as the script environment is ready in the webview
- (void)webView:(WebView *)sender didClearWindowObject:(WebScriptObject *)windowScriptObject forFrame:(WebFrame *)frame
{
    NSString *ip = [self getIPAddress];
    NSString *networkinterface = [NSString stringWithFormat:@"isOSXApp=true;networkinterface={};networkinterface.getIPAddress=function(callback){callback('%@');};", ip];
    [webView stringByEvaluatingJavaScriptFromString:networkinterface];
}

// Prevent authentication dialog from being presented to the user
- (void)webView:(WebView *)sender resource:(id)identifier didReceiveAuthenticationChallenge:(NSURLAuthenticationChallenge *)challenge fromDataSource:(WebDataSource *)dataSource {
    [[challenge sender] cancelAuthenticationChallenge:challenge];
}

// Prevent the main view from bouncing
- (void)webView:(WebView *)sender didFinishLoadForFrame:(WebFrame *)frame {
    NSScrollView *mainScrollView = sender.mainFrame.frameView.documentView.enclosingScrollView;
    [mainScrollView setVerticalScrollElasticity:NSScrollElasticityNone];
    [mainScrollView setHorizontalScrollElasticity:NSScrollElasticityNone];
}

@end
