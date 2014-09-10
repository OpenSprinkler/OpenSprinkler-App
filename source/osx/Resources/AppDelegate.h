//
//  AppDelegate.h
//  Sprinklers
//
//  Created by Samer Albahra on 7/24/14.
//  Copyright (c) 2014 Samer Albahra. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <WebKit/WebPreferences.h>

@interface AppDelegate : NSObject  {
	NSWindow *window;
	IBOutlet WebView *webView;
}

@property (strong) IBOutlet NSWindow *window;
@property (nonatomic, retain) IBOutlet WebView *webView;

@end

@interface WebPreferences (WebPreferencesPrivate)
- (void)_setLocalStorageDatabasePath:(NSString *)path;
- (void) setLocalStorageEnabled: (BOOL) localStorageEnabled;
- (void)webView:(WebView *)sender frame:(WebFrame *)frame exceededDatabaseQuotaForSecurityOrigin:(id) origin database:(NSString *)databaseIdentifier;
@end