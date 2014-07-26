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
    WebPreferences *prefs = [webView preferences];
    [prefs _setLocalStorageDatabasePath:@"~/Library/Sprinklers/LocalStorage"];
    [prefs setLocalStorageEnabled:YES];
	NSString *resourcesPath = [[NSBundle mainBundle] resourcePath];
	NSString *htmlPath = [resourcesPath stringByAppendingString:@"/index.html"];
	[[webView mainFrame] loadRequest:[NSURLRequest requestWithURL:[NSURL fileURLWithPath:htmlPath]]];
    [self.window setContentView:self.webView];
    [webView setPolicyDelegate:self];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender
{
    return YES;
}

-(void)webView:(WebView *)webView decidePolicyForNavigationAction:(NSDictionary *)actionInformation request:(NSURLRequest *)request frame:(WebFrame *)frame decisionListener:(id<WebPolicyDecisionListener>)listener
{
    if (WebNavigationTypeLinkClicked == [[actionInformation objectForKey:WebActionNavigationTypeKey] intValue])
    {
        [listener ignore];
        [[NSWorkspace sharedWorkspace] openURL:[request URL]];
        
    }
    [listener use];
}

-(void)webView:(WebView *)webView decidePolicyForNewWindowAction:(NSDictionary *)actionInformation request:(NSURLRequest *)request newFrameName:(NSString *)frameName decisionListener:(id <WebPolicyDecisionListener>)listener
{
    if (WebNavigationTypeLinkClicked == [[actionInformation objectForKey:WebActionNavigationTypeKey] intValue])
    {
        [listener ignore];
        [[NSWorkspace sharedWorkspace] openURL:[request URL]];
    }
    [listener ignore];
}

@end
