/* OpenSprinkler App Tests
 * Test suite for Sites URL functionality
 */

describe("OSApp.Sites URL Helper Functions", function() {
	
	// Test URL parsing functionality
	describe("parseURL", function() {
		
		it("should parse valid HTTP URLs correctly", function() {
			var result = OSApp.Sites.parseURL("http://example.com:8080/path");
			expect(result).to.not.be.null;
			expect(result.protocol).to.equal("http");
			expect(result.hostname).to.equal("example.com");
			expect(result.port).to.equal("8080");
			expect(result.pathname).to.equal("/path");
			expect(result.hostWithPort).to.equal("example.com:8080");
		});
		
		it("should parse valid HTTPS URLs correctly", function() {
			var result = OSApp.Sites.parseURL("https://secure.example.com/os/");
			expect(result).to.not.be.null;
			expect(result.protocol).to.equal("https");
			expect(result.hostname).to.equal("secure.example.com");
			expect(result.port).to.equal("443");
			expect(result.pathname).to.equal("/os/");
		});
		
		it("should add default protocol for URLs without protocol", function() {
			var result = OSApp.Sites.parseURL("example.com:8080");
			expect(result).to.not.be.null;
			expect(result.protocol).to.equal("http");
			expect(result.hostname).to.equal("example.com");
			expect(result.port).to.equal("8080");
		});
		
		it("should handle URLs with default ports", function() {
			var result = OSApp.Sites.parseURL("http://example.com");
			expect(result).to.not.be.null;
			expect(result.protocol).to.equal("http");
			expect(result.port).to.equal("80");
			expect(result.hostWithPort).to.equal("example.com");
		});
		
		it("should return null for invalid URLs", function() {
			expect(OSApp.Sites.parseURL("")).to.be.null;
			expect(OSApp.Sites.parseURL(null)).to.be.null;
			expect(OSApp.Sites.parseURL(undefined)).to.be.null;
			// Note: "not-a-url" is treated as a hostname by the URL constructor
		});
		
	});
	
	// Test URL building functionality
	describe("buildURL", function() {
		
		it("should build URLs correctly with all components", function() {
			var result = OSApp.Sites.buildURL("https", "example.com:8080", "/path");
			expect(result).to.equal("https://example.com:8080/path");
		});
		
		it("should use defaults when components are missing", function() {
			var result = OSApp.Sites.buildURL("", "example.com", "");
			expect(result).to.equal("http://example.com");
		});
		
		it("should handle path normalization", function() {
			var result = OSApp.Sites.buildURL("https", "example.com", "path");
			expect(result).to.equal("https://example.com/path");
		});
		
		it("should return empty string for missing IP", function() {
			var result = OSApp.Sites.buildURL("https", "", "/path");
			expect(result).to.equal("");
		});
		
	});
	
	// Test IP extraction functionality
	describe("extractIPFromURL", function() {
		
		it("should extract IP and port from simple URLs", function() {
			var result = OSApp.Sites.extractIPFromURL("http://192.168.1.100:8080");
			expect(result).to.equal("192.168.1.100:8080");
		});
		
		it("should extract hostname from URLs", function() {
			var result = OSApp.Sites.extractIPFromURL("https://opensprinkler.local");
			expect(result).to.equal("opensprinkler.local");
		});
		
		it("should include path when present", function() {
			var result = OSApp.Sites.extractIPFromURL("https://example.com/os/");
			expect(result).to.equal("example.com/os/");
		});
		
		it("should handle custom ports", function() {
			var result = OSApp.Sites.extractIPFromURL("http://example.com:9999/path");
			expect(result).to.equal("example.com:9999/path");
		});
		
		it("should omit default ports", function() {
			var result = OSApp.Sites.extractIPFromURL("http://example.com:80");
			expect(result).to.equal("example.com");
			
			result = OSApp.Sites.extractIPFromURL("https://example.com:443");
			expect(result).to.equal("example.com");
		});
		
	});
	
	// Test migration functionality
	describe("migrateToURL", function() {
		
		it("should migrate IP+SSL configuration to URL", function() {
			var oldSite = {
				os_ip: "example.com:8080",
				ssl: "1",
				os_pw: "password"
			};
			
			var migrated = OSApp.Sites.migrateToURL(oldSite);
			
			expect(migrated.os_url).to.equal("https://example.com:8080");
			expect(migrated.os_ip).to.equal("example.com:8080"); // Should be preserved
			expect(migrated.ssl).to.equal("1"); // Should be preserved
		});
		
		it("should migrate IP without SSL to HTTP URL", function() {
			var oldSite = {
				os_ip: "192.168.1.100",
				os_pw: "password"
			};
			
			var migrated = OSApp.Sites.migrateToURL(oldSite);
			
			expect(migrated.os_url).to.equal("http://192.168.1.100");
			expect(migrated.os_ip).to.equal("192.168.1.100");
		});
		
		it("should not modify sites that already have URL", function() {
			var newSite = {
				os_url: "https://example.com:9999/os/",
				os_pw: "password"
			};
			
			var migrated = OSApp.Sites.migrateToURL(newSite);
			
			expect(migrated).to.deep.equal(newSite);
		});
		
		it("should handle sites without IP", function() {
			var tokenSite = {
				os_token: "token123",
				os_pw: "password"
			};
			
			var migrated = OSApp.Sites.migrateToURL(tokenSite);
			
			expect(migrated).to.deep.equal(tokenSite);
			expect(migrated.os_url).to.be.undefined;
		});
		
	});
	
});