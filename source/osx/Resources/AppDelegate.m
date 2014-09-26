//
//  AppDelegate.m
//  Sprinklers
//
//  Created by Samer Albahra on 7/24/14.
//  Copyright (c) 2014 Samer Albahra. All rights reserved.
//

#pragma GCC diagnostic ignored "-Wundeclared-selector"
#import "AppDelegate.h"
#import "WebKit/WebPolicyDelegate.h"
#include "WebStorageManagerPrivate.h"
#include "WebPreferencesPrivate.h"

@implementation AppDelegate

@synthesize window;
@synthesize webView;

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
}

- (void)awakeFromNib {
    // Enable localStorage in webView
    
    NSString* dbPath = [WebStorageManager _storageDirectoryPath];
    
    WebPreferences* prefs = [self.webView preferences];
    NSString* localDBPath = [prefs _localStorageDatabasePath];
    
    // PATHS MUST MATCH!!!!  otherwise localstorage file is erased when starting program
    if( [localDBPath isEqualToString:dbPath] == NO) {
        [prefs setAutosaves:YES];  //SET PREFS AUTOSAVE FIRST otherwise settings aren't saved.
        // Define application cache quota
        static const unsigned long long defaultTotalQuota = 10 * 1024 * 1024; // 10MB
        static const unsigned long long defaultOriginQuota = 5 * 1024 * 1024; // 5MB
        [prefs setApplicationCacheTotalQuota:defaultTotalQuota];
        [prefs setApplicationCacheDefaultOriginQuota:defaultOriginQuota];
        
        [prefs setWebGLEnabled:YES];
        [prefs setOfflineWebApplicationCacheEnabled:YES];
        
        [prefs setDatabasesEnabled:YES];
        [prefs setDeveloperExtrasEnabled:[[NSUserDefaults standardUserDefaults] boolForKey: @"developer"]];
        
        #ifdef DEBUG
        [prefs setDeveloperExtrasEnabled:YES];
        #endif
        [prefs _setLocalStorageDatabasePath:dbPath];
        [prefs setLocalStorageEnabled:YES];
        
        [self.webView setPreferences:prefs];
    }
    
    // Get notification when scripting environment becomes available
    [webView setFrameLoadDelegate:self];

    // Handle authentication request
    [webView setResourceLoadDelegate:self];

    // Get notification on navigation changes (AJAX)
    [webView setPolicyDelegate:self];

    // Make webView part of the window's contentView
    [self.window setContentView:self.webView];

    // Load the index.htm page
	NSString *resourcesPath = [[NSBundle mainBundle] resourcePath];
	NSString *htmlPath = [resourcesPath stringByAppendingString:@"/index.htm"];
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
